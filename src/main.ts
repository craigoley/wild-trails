/**
 * Entry point + the fixed-timestep game loop with render interpolation.
 *
 *   gather input -> step sim in fixed SIM_DT slices -> render(interpolated)
 *
 * Real frame time is accumulated and the sim is advanced in whole SIM_DT steps;
 * the leftover remainder becomes `alpha` (0..1), and the renderers lerp each
 * entity between its previous and current sim-step position by that alpha. So
 * the simulation stays deterministic and frame-rate independent while motion
 * looks smooth at 60 or 120 Hz. The player moves because GameState.update
 * mutates state — never because input is wired straight into this loop.
 *
 * The world now has CREATURES you can CATCH: approach an animal, press catch, and
 * watch the multi-shake resolution play out. The shake animation + audio are
 * driven by the DATA that GameState resolved (Catch.resolveCatch) — feel reflects
 * the real odds, never faked over them. The spawn -> roam -> catch pipeline
 * carries `?debug=1` funnel telemetry.
 */

import './style.css';
import { createGameState, update } from './game/GameState';
import { Controls } from './input/Controls';
import { SceneManager } from './rendering/SceneManager';
import { WorldRenderer } from './rendering/WorldRenderer';
import { EntityRenderer } from './rendering/EntityRenderer';
import { HUD, isDebugEnabled } from './rendering/HUD';
import { TimeIndicator } from './rendering/TimeIndicator';
import { JournalPanel } from './rendering/JournalPanel';
import { MissionPanel, type MissionTelemetry } from './rendering/MissionPanel';
import { ScrollProbe } from './rendering/ScrollProbe';
import { syncModalOpenClass } from './rendering/modalClass';
import { Banner } from './rendering/Banner';
import { missionBannerMessages } from './rendering/missionBanners';
import { AudioEngine } from './audio/AudioEngine';
import { createAutosaver, foundCount, loadJournal, recordCatch, setBaitCounts } from './state/Journal';
import { addCredits, creditsForCatch } from './game/Economy';
import {
  createOnboarding,
  skipOnboarding,
  tickOnboarding,
  type PromptStep,
} from './game/Onboarding';
import { StartScreen } from './rendering/StartScreen';
import { restoreBaitCounts } from './game/Bait';
import { evaluateCatch, shouldCelebrateWin } from './game/Missions';
import { WinScreen } from './rendering/WinScreen';
import { unlockBiome } from './game/World';
import { MAX_FRAME_DT, MISSION_ORDER, ONBOARDING, SIM_DT, TRACKING, type BiomeId } from './utils/constants';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app container not found');

// --- State (pure) ---------------------------------------------------------
// A fresh per-load seed keeps the sim deterministic-from-seed while still
// varying run to run. Reading the clock here (the impure entry point) keeps the
// game layer itself pure.
const bootSeed = (Date.now() & 0xffffffff) >>> 0;
const game = createGameState(bootSeed);
// The persistent Field Journal — the fleet's first real localStorage collection.
// Loaded once at boot (safe no-op in private mode); the journal lives HERE at the
// boundary (cross-session meta-progress), not in the per-run GameState. A catch
// records into it + persists (the impure save stays out of the deterministic sim).
const journal = loadJournal();
// Apply persisted mission-granted unlocks to the live world at boot (so a
// returning player keeps the regions they earned). Reuses World's unlock path.
for (const id of journal.unlockedBiomes) {
  if (id in game.world.biomes) unlockBiome(game.world, id as BiomeId);
}
// Rehydrate the ONE durable bit of session state — bait counts (Plan #13.3).
// Everything else (player position, clock, animals) is recomputed fresh by
// createGameState; only the bait stockpile carries across a reload.
restoreBaitCounts(game.bait, journal.bait);

// Autosave: silent, dedup-guarded. persist() syncs the live bait into the journal
// then writes (only if the store actually changed). Fired on durable milestones
// (catch / mission) + bait deploy + tab blur — never per-frame.
const autosave = createAutosaver();
const persist = (): void => {
  setBaitCounts(journal, game.bait.counts);
  autosave(journal);
};
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persist();
});
if (isDebugEnabled()) {
  const species = Object.keys(journal.species).length;
  console.info(`[journal] v${journal.schemaVersion} loaded, ${species} species recorded`);
}

// Mission funnel telemetry (cumulative session counts; ?debug only). offered is
// the static mission count; started is derived from the journal each refresh.
const missionTelemetry: MissionTelemetry = {
  offered: MISSION_ORDER.length,
  started: 0,
  progressed: 0,
  completed: 0,
  rewardsClaimed: 0,
};
const refreshMissionPanel = (): void => {
  missionTelemetry.started = MISSION_ORDER.filter(
    (id) => (journal.missions[id]?.progress ?? 0) > 0,
  ).length;
  missionPanel.refresh(journal, missionTelemetry, isDebugEnabled());
};

// --- Adapters & rendering (impure; read state) ----------------------------
const controls = new Controls(app);
const scene = new SceneManager(app);
const worldRenderer = new WorldRenderer(scene.scene, game.world);
const entities = new EntityRenderer(scene.scene);
const hud = new HUD(app);
// Time-of-day indicator (top-left) — makes the day-night cycle legible: the
// last invisible core mechanic. Reads game.dayPhase + game.timeSec each frame.
const timeIndicator = new TimeIndicator(app);
const journalPanel = new JournalPanel(app);
journalPanel.refresh(journal); // seed the roster from the loaded journal
const missionPanel = new MissionPanel(app);
refreshMissionPanel();
// Runtime scroll PROBE (debug instrumentation, not a fix) — ?debug=1-gated, inert
// in normal play. Reads the live scroll-chain values when a panel is open so the
// real cause of the iOS scroll bug is legible on-device.
new ScrollProbe(app);
// The "Field Guide Complete" win screen (Plan #10). maybeFireWin fires it ONCE —
// when the win condition is first met (the persisted `won` flag guards re-firing)
// — then dismissing it returns to free-roam. Checked at boot (so a save that
// completed pre-#10 gets its celebration) and after each catch/mission update.
const winScreen = new WinScreen(app);
const maybeFireWin = (): void => {
  if (shouldCelebrateWin(journal)) {
    journal.won = true;
    persist();
    winScreen.show(journal);
  }
};
maybeFireWin(); // boot check (a pre-#10 completed save earns its celebration now)

// Onboarding (Plan #11) — first-run only (an empty journal); a returning player is
// never re-onboarded. The contextual prompts flow through the game.notice channel.
const firstRun = foundCount(journal) === 0;
const onboarding = createOnboarding(firstRun);
let hasMoved = false;
const onboardSit = { moved: false, animalNearby: false, catchArmed: false, caughtAny: false };
const showOnboardPrompt = (step: PromptStep): void => {
  game.notice = { text: ONBOARDING.prompts[step], timer: ONBOARDING.beatSec, ttl: ONBOARDING.beatSec };
};
// The warm title splash: dismissing it begins play (+ the first prompt on a first
// run); Skip suppresses the contextual prompts. Closeable (overlayDismiss).
const startScreen = new StartScreen(app, {
  onStart: () => {
    if (onboarding.active) showOnboardPrompt('move'); // first prompt, once in play
  },
  onSkip: () => skipOnboarding(onboarding),
});
startScreen.show(firstRun);
// Tracks the body.modal-open flag so the per-frame sync only writes on transitions.
let modalOpenPrev = false;
// Transient banners for mission completions + biome unlocks (the missing
// player-facing feedback — the unlock previously fired silently).
const banner = new Banner(app);

// Frame the camera on the player's spawn — no slide-in on frame 1.
scene.snapFocus(game.player.x, game.player.y);

// Audio context is created now but only resumed after a user gesture (autoplay).
const audio = new AudioEngine();
audio.init();
const unlockAudio = (): void => {
  void audio.resume();
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
};
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

// --- Loop -----------------------------------------------------------------
let lastMs = performance.now();
let accumulator = 0;
// Catch-audio bookkeeping: blip once per shake beat as it begins, and fire the
// settle/break tone on resolution — all read from the resolved encounter DATA.
let prevEncounterActive = false;
let prevShakeIndex = 0;

function frame(nowMs: number): void {
  let dt = (nowMs - lastMs) / 1000;
  lastMs = nowMs;
  dt = Math.min(dt, MAX_FRAME_DT);

  // Tracking puzzle (Plan #8b): the BOUNDARY tells the sim whether a tracking
  // mission is in progress (the sim doesn't read the journal). Active until the
  // target is caught (the mission completes); drives the seeded sett spawn + hints.
  game.activeTrackTarget = journal.missions['track-badger']?.completed ? null : TRACKING.target;

  // Step the sim in fixed slices; the remainder interpolates the render.
  accumulator += dt;
  while (accumulator >= SIM_DT) {
    update(game, controls.intent, SIM_DT);
    accumulator -= SIM_DT;

    // Audio cues from this sim step (checked per-step so none are missed when a
    // frame runs several steps).
    const enc = game.encounter;
    if (enc) {
      if (!prevEncounterActive) {
        audio.shakeBlip(0, enc.shakes[0].passed); // first shake begins
      } else if (
        enc.phase === 'shaking' &&
        enc.shakeIndex > prevShakeIndex &&
        enc.shakeIndex < enc.shakes.length
      ) {
        audio.shakeBlip(enc.shakeIndex, enc.shakes[enc.shakeIndex].passed);
      }
      prevShakeIndex = enc.shakeIndex;
      prevEncounterActive = true;
    } else {
      prevEncounterActive = false;
      prevShakeIndex = 0;
    }
    if (game.lastOutcome === 'caught') audio.catchTone();
    else if (game.lastOutcome === 'escaped') audio.escapeTone();
    if (game.baitJustDeployed) {
      audio.baitBlip();
      controls.pulseBait();
      persist(); // a deploy spent bait (durable) — autosave it (dedup-guarded)
    }
    if (game.baitDeployFailed) audio.denyBlip();

    // A catch resolved this step -> record it to the journal AND evaluate
    // missions, both at the boundary. Pure recordCatch / evaluateCatch (Date.now
    // and the unlock-application happen here, never in the deterministic sim).
    if (game.lastCaughtSpecies && game.lastCaughtBiome && game.lastCaughtPhase) {
      // Economy (§12 slice 1a): credits earned by the catch — computed from the
      // PRE-catch journal (so the new-species / biome-complete bonuses see the
      // gap this catch fills), then granted. Separate from rank; persisted (v5).
      addCredits(journal, creditsForCatch(journal, game.lastCaughtSpecies).total);
      recordCatch(journal, game.lastCaughtSpecies, Date.now());
      const evalResult = evaluateCatch(journal, {
        species: game.lastCaughtSpecies,
        biome: game.lastCaughtBiome,
        phase: game.lastCaughtPhase,
      });
      // Apply any unlock reward to the live world (reuse World's unlock path).
      for (const id of evalResult.unlocked) unlockBiome(game.world, id);
      // Refresh the locked-region visuals so the now-open seam's stale wall / fog /
      // dim clears (the build-once renderer didn't update on a mid-session unlock).
      if (evalResult.unlocked.length > 0) worldRenderer.refresh(game.world);
      // Player-facing feedback: a banner per completion + per unlock, + a tone.
      // (Previously completions/unlocks were silent — only telemetry + the panel.)
      for (const msg of missionBannerMessages(evalResult)) banner.enqueue(msg.text, msg.kind);
      if (evalResult.completed.length > 0) audio.missionTone();
      if (evalResult.unlocked.length > 0) audio.unlockFanfare();
      // Funnel telemetry.
      missionTelemetry.progressed += evalResult.progressed.length;
      missionTelemetry.completed += evalResult.completed.length;
      missionTelemetry.rewardsClaimed += evalResult.completed.length;
      persist(); // catch + replenished bait = durable progress; autosave it
      journalPanel.refresh(journal);
      refreshMissionPanel();
      maybeFireWin(); // this catch/mission may have completed the field guide
    }
  }
  const alpha = accumulator / SIM_DT;

  // Onboarding (Plan #11): advance the contextual prompt machine from the player's
  // situation. It GUIDES, never gates — the sim above already ran regardless.
  if (onboarding.active) {
    if (Math.abs(controls.intent.moveX) > ONBOARDING.moveThreshold || Math.abs(controls.intent.moveY) > ONBOARDING.moveThreshold) {
      hasMoved = true;
    }
    onboardSit.moved = hasMoved;
    onboardSit.animalNearby = game.animals.some((a) => a.active);
    onboardSit.catchArmed = game.catchArmed;
    onboardSit.caughtAny = game.sessionCatches > 0;
    const step = tickOnboarding(onboarding, onboardSit, dt);
    if (step) showOnboardPrompt(step);
  }

  // Hide the gameplay HUD while ANY overlay panel is open (mobile layering fix) —
  // POLLED so it clears on every close path (✕ / backdrop / Escape / programmatic),
  // each of which ends with the panel reporting isOpen() === false.
  const modalOpen =
    journalPanel.isOpen() || missionPanel.isOpen() || winScreen.isOpen() || startScreen.isOpen();
  if (modalOpen !== modalOpenPrev) {
    syncModalOpenClass(modalOpen);
    modalOpenPrev = modalOpen;
  }

  // Fade the mission/unlock banner on real frame time (it's render-side feedback).
  banner.tick(dt);

  // Reflect the catch target on the UI: arm the CATCH button + show the live
  // chance, and surface the first-time "try bait" hint.
  controls.setCatchState(game.catchArmed, game.targetChance);
  controls.setBaitHint(game.catchArmed && !game.targetBaited && !game.usedBaitEver);
  controls.setBaitTray(game.bait);

  // Field Journal toggle (UI-only edge action; consumed at the boundary, not the
  // sim). Refresh on open so it shows the latest roster.
  if (controls.intent.journalToggle) {
    controls.intent.journalToggle = false;
    journalPanel.setOpen(!journalPanel.isOpen());
    if (journalPanel.isOpen()) journalPanel.refresh(journal);
  }
  // Missions toggle (M).
  if (controls.intent.missionToggle) {
    controls.intent.missionToggle = false;
    missionPanel.setOpen(!missionPanel.isOpen());
    if (missionPanel.isOpen()) refreshMissionPanel();
  }

  // Render the interpolated state. Renderers read prev+current; never mutate.
  entities.sync(game, alpha);
  scene.updateFollow(game, alpha, dt);
  scene.render();
  hud.update(game);
  hud.setCredits(journal.credits); // §12 1a — the persistent balance (cheap text set)
  timeIndicator.update(game.dayPhase, game.timeSec);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
