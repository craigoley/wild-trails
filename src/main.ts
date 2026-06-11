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
import { readTestSeed, isFrozen, applyTestScene, signalRenderReady } from './testHooks';
import { Controls } from './input/Controls';
import { SceneManager } from './rendering/SceneManager';
import { WorldRenderer } from './rendering/WorldRenderer';
import { EntityRenderer } from './rendering/EntityRenderer';
import { HUD, isDebugEnabled } from './rendering/HUD';
import { TimeIndicator } from './rendering/TimeIndicator';
import { JournalPanel } from './rendering/JournalPanel';
import { MissionPanel, type MissionTelemetry } from './rendering/MissionPanel';
import { ResearchPanel } from './rendering/ResearchPanel';
import { BaitPanel } from './rendering/BaitPanel';
import { evaluateResearch, startResearch, completeResearch, isBaitUnlocked } from './game/Research';
import { thrivingByBiome } from './game/Thriving';
import { grantTool } from './game/Tools';
import { syncModalOpenClass } from './rendering/modalClass';
import { Banner } from './rendering/Banner';
import { missionBannerMessages, researchBannerMessages } from './rendering/missionBanners';
import { AudioEngine } from './audio/AudioEngine';
import { AmbientAudio } from './audio/AmbientAudio';
import { loadSettings, saveSettings } from './state/Settings';
import { createAutosaver, foundCount, loadJournal, recordCatch, setBaitCounts } from './state/Journal';
import { addCredits, creditsForCatch } from './game/Economy';
import { ShopPanel } from './rendering/ShopPanel';
import {
  createOnboarding,
  skipOnboarding,
  tickOnboarding,
  type PromptStep,
} from './game/Onboarding';
import { StartScreen } from './rendering/StartScreen';
import { restoreBaitCounts } from './game/Bait';
import { evaluateCatch, reconcileResearchUnlocks, shouldCelebrateWin } from './game/Missions';
import { WinScreen } from './rendering/WinScreen';
import { unlockBiome, supplyPostAt, supplyExitPosition, clampToUnlocked } from './game/World';
import {
  BAIT_DISPLAY,
  BIOMES,
  MAX_FRAME_DT,
  MISSION_ORDER,
  ONBOARDING,
  PLAYER,
  RESEARCH_PROJECTS,
  SIM_DT,
  SUPPLY_POSTS,
  TOOLS,
  TRACKING,
  type BaitId,
  type BiomeId,
  type ResearchReward,
} from './utils/constants';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app container not found');

// --- State (pure) ---------------------------------------------------------
// A fresh per-load seed keeps the sim deterministic-from-seed while still varying
// run to run. Reading the clock here (the impure entry point) keeps the game layer
// itself pure. L2: a ?seed=N URL param pins the seed for a deterministic capture.
const testSeed = readTestSeed();
const bootSeed = testSeed !== null ? testSeed : (Date.now() & 0xffffffff) >>> 0;
const l2Frozen = isFrozen(); // L2 visual scenes pause the sim for a deterministic capture
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
// Equip the persisted active net (Nets & Gear slice A) — the durable inventory lives
// in the journal; the live sim reads game.tool. Defaults to the starter Hand Net.
game.tool = journal.activeTool;
// L2 deterministic-scene setup (no-op in normal play) — BEFORE the renderer builds, so
// e.g. ?unlock=all opens biomes and the world renders without the locked-region fog.
applyTestScene(game);

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
// §4.3 TL1 — seed the per-biome warmth grade from the loaded journal (a returning player's
// studied biomes start warm; a fresh one starts in the quiet muted baseline). Cosmetic.
worldRenderer.setThriving(thrivingByBiome(journal));
const entities = new EntityRenderer(scene.scene);
const hud = new HUD(app);
// Time-of-day indicator (top-left) — makes the day-night cycle legible: the
// last invisible core mechanic. Reads game.dayPhase + game.timeSec each frame.
const timeIndicator = new TimeIndicator(app);
const journalPanel = new JournalPanel(app);
journalPanel.refresh(journal); // seed the roster from the loaded journal
const missionPanel = new MissionPanel(app);
refreshMissionPanel();
// Bait selection sub-screen — type-selection moved off the main HUD (declutter).
// A row tap writes the SAME baitSelect intent the 1/2/3 keys use (the pure sim path
// is unchanged); the on-screen BAIT button still deploys the selected bait one-tap.
const baitPanel = new BaitPanel(app, (index) => {
  controls.intent.baitSelect = index;
});
// The Research panel (§4.1.4 R0b) — start a project (spend credits), and complete a ready
// one (charge any top-up + reveal its journal-knowledge layer). Both persist.
const researchPanel = new ResearchPanel(
  app,
  (id) => {
    if (startResearch(journal, id)) persist();
  },
  (id) => {
    const reward = completeResearch(journal, id);
    if (reward) {
      banner.enqueue(`Research complete: ${RESEARCH_PROJECTS[id].name}`, 'research');
      applyResearchReward(reward); // R1: a grant-tool reward owns the net here
      persist();
      journalPanel.refresh(journal); // the new card layer shows if the dex is open
      shopPanel.refresh(journal, game.bait); // a newly-granted net shows as equippable
    }
  },
);

/**
 * Apply a completed research project's REWARD to the live game (R0b/R1 — the reward
 * EFFECTS). `journal-layer` is a READ the dex card does (no action). `grant-tool` (R1) owns
 * the net via the swappable grantTool seam B1 built — research is the single net path; the
 * net stays lateral, the player equips it in the Field Supply. `shop-access` / `biome-access`
 * are future (R2) — no-op here.
 */
function applyResearchReward(reward: ResearchReward): void {
  if (reward.kind === 'grant-tool') {
    grantTool(journal, reward.toolId);
    banner.enqueue(`New net unlocked: ${TOOLS[reward.toolId].displayName} — equip it in the Field Supply`, 'research');
  } else if (reward.kind === 'bait-access') {
    // §4.1.5 — fish bait is now BUYABLE in the Field Supply (the unlock derives from the
    // completed project; the shop reads it). The tray's chip un-hides once it's unlocked.
    banner.enqueue(`New bait unlocked: ${BAIT_DISPLAY[reward.bait].label} — buy it in the Field Supply`, 'research');
  }
  // 'biome-access' is handled by the order-independent reconcileResearchUnlocks (R2); 'journal-layer'
  // is a READ the dex card does (R0b). No-ops here.
}
// The Field Supply (§12 1b) — spend credits on extra bait. A purchase persists (so
// it survives reload); the buy mutates journal.credits + the live game.bait counts.
const shopPanel = new ShopPanel(app, persist, (toolId) => {
  // Equip a net: the journal already holds the active selection (set by equipTool);
  // sync the live sim's tool + persist (Nets & Gear slice A).
  game.tool = toolId;
  persist();
});
// Walk-in state for the supply post — fires the panel open on the entry edge only.
// Walk-in tracking: detect the close EDGE (open→closed) to step the player out.
let shopWasOpen = false;
const exitOut = { x: 0, y: 0 }; // reused — no per-frame alloc in the loop
const baitUnlocked = (id: BaitId): boolean => isBaitUnlocked(journal, id);
// The §4.3 capstone win screen (Plan #10). maybeFireWin fires it ONCE — when the
// win condition is first met (the persisted `won` flag guards re-firing) — then
// dismissing it returns to free-roam. Checked at boot (so a save that completed
// pre-#10 gets its celebration) and after each catch/mission update. ⚠️ The TRIGGER
// (shouldCelebrateWin) is unchanged by the capstone — only the framing shifted.
const winScreen = new WinScreen(app);
const maybeFireWin = (): void => {
  if (shouldCelebrateWin(journal)) {
    journal.won = true;
    persist();
    winScreen.show();
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
// A frozen L2 scene captures the staged WORLD — so skip the title splash + onboarding prompts
// (they're an HTML overlay that would otherwise cover the canvas, capturing the splash instead
// of the game). Only ?freeze captures take this path; normal boot shows the splash as before.
if (l2Frozen) {
  skipOnboarding(onboarding);
} else {
  startScreen.show(firstRun);
}
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
// Atmosphere A1: device settings (mute) live in a SEPARATE localStorage key (not the save).
// Apply the persisted mute now (the master bus starts at the right level) + reflect the glyph.
const settings = loadSettings();
audio.setMuted(settings.muted);
controls.setMuted(settings.muted);
// The ambient soundscape SHARES audio's one AudioContext + master bus (the iOS one-context
// rule + so mute covers it). Null only if Web Audio is unavailable (a headless/no-device boot).
const ambient =
  audio.context && audio.master ? new AmbientAudio(audio.context, audio.master) : null;
const unlockAudio = (): void => {
  void audio.resume();
  ambient?.start(); // build + start the ambient bed on the SAME gesture that resumes (iOS-safe)
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
// L2: one-shot guard so the first-frame-ready signal fires exactly once.
let renderReadySignalled = false;

function frame(nowMs: number): void {
  let dt = (nowMs - lastMs) / 1000;
  lastMs = nowMs;
  dt = Math.min(dt, MAX_FRAME_DT);

  // Tracking puzzle (Plan #8b): the BOUNDARY tells the sim whether a tracking
  // mission is in progress (the sim doesn't read the journal). Active until the
  // target is caught (the mission completes); drives the seeded sett spawn + hints.
  game.activeTrackTarget = journal.missions['track-badger']?.completed ? null : TRACKING.target;

  // The player is ROOTED while the Field Supply is open (they're inside the
  // building) — the sim ignores movement input; the world otherwise lives on (§12 1b).
  game.movementFrozen = shopPanel.isOpen();

  // Step the sim in fixed slices; the remainder interpolates the render. L2: a frozen
  // scene (?freeze=1) never advances the accumulator, so it renders the deterministic
  // initial state every frame — a stable visual baseline regardless of capture timing.
  if (!l2Frozen) accumulator += dt;
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
      // §4.3 TL1 — a newly-catalogued species may have raised this biome's "thriving"; re-grade
      // the world's warmth (cosmetic, in place). BEFORE any unlock refresh, so a rebuild reads it.
      worldRenderer.setThriving(thrivingByBiome(journal));
      const evalResult = evaluateCatch(journal, {
        species: game.lastCaughtSpecies,
        biome: game.lastCaughtBiome,
        phase: game.lastCaughtPhase,
        bait: game.lastCaughtBait, // §4.4 — the bait active at catch time (multi-condition challenges)
      });
      // §4.1b: the one-time research-challenge credit bonus (separate from the
      // catch's own credits, granted above). Applied at the boundary like all credits.
      if (evalResult.creditsAwarded > 0) addCredits(journal, evalResult.creditsAwarded);
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
      // §4.1.4 R0b: research advances on the SAME catch event — it READS the event (the
      // catch math is untouched). Its progress/completion fire the nudge banner; a project
      // that auto-completes this catch fires its reward (R1: a grant-tool net is granted).
      const researchResult = evaluateResearch(journal, {
        species: game.lastCaughtSpecies,
        biome: game.lastCaughtBiome,
        phase: game.lastCaughtPhase,
      });
      for (const msg of researchBannerMessages(journal, researchResult)) banner.enqueue(msg.text, msg.kind);
      for (const reward of researchResult.rewards) applyResearchReward(reward); // R1: grant a net it earned
      // §4.1.4 R2 (the finale): the §4.1c Wetland->Highlands gate, WRAPPED in research. The
      // Highlands unlocks when its research project is complete AND the §4.1c gate (the
      // wetland set + the research-mouse-night mastery challenge, by play) holds —
      // double-enforcing knowledge-by-play. Order-independent: this reconcile fires whether
      // the project or the §4.1c gate finished last (it runs every catch).
      const researchUnlocked = reconcileResearchUnlocks(journal);
      for (const uid of researchUnlocked) {
        unlockBiome(game.world, uid);
        banner.enqueue(`New area unlocked: ${BIOMES[uid].displayName}!`, 'unlock');
      }
      if (researchUnlocked.length > 0) {
        worldRenderer.refresh(game.world); // clear the now-open seam's stale wall / fog / dim
        audio.unlockFanfare();
      }
      persist(); // catch + bait + research progress + any net grant / area unlock = durable; autosave
      journalPanel.refresh(journal);
      researchPanel.refresh(journal);
      if (researchResult.rewards.length > 0) shopPanel.refresh(journal, game.bait); // new net equippable
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
    journalPanel.isOpen() ||
    missionPanel.isOpen() ||
    researchPanel.isOpen() ||
    baitPanel.isOpen() ||
    shopPanel.isOpen() ||
    winScreen.isOpen() ||
    startScreen.isOpen();
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
  controls.setCurrentBait(game.bait);

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
  // Research toggle (R) — §4.1.4 R0b.
  if (controls.intent.researchToggle) {
    controls.intent.researchToggle = false;
    researchPanel.setOpen(!researchPanel.isOpen());
    if (researchPanel.isOpen()) researchPanel.refresh(journal);
  }
  // Bait selection sub-screen toggle (🪱) — refresh from the live bait on open so the
  // counts + selected highlight are current.
  if (controls.intent.baitPanelToggle) {
    controls.intent.baitPanelToggle = false;
    baitPanel.setOpen(!baitPanel.isOpen());
    if (baitPanel.isOpen()) baitPanel.refresh(game.bait, baitUnlocked);
  }
  // Mute toggle (K) — Atmosphere A1. Flips the master bus + remembers it (device setting,
  // separate from the save). Always available; instant.
  if (controls.intent.muteToggle) {
    controls.intent.muteToggle = false;
    const muted = !audio.isMuted();
    audio.setMuted(muted);
    controls.setMuted(muted);
    saveSettings({ muted });
  }
  // Field Supply walk-in (§12 1b): a building you physically enter. The player is
  // frozen while it's open (above); CLOSING it steps them OUT the door, which also
  // guarantees no reopen-trap by POSITION (you're no longer in the zone).
  const shopOpen = shopPanel.isOpen();
  if (shopWasOpen && !shopOpen) {
    // Just closed (✕/backdrop/Escape). The player was frozen IN the zone — step them
    // out the door (−y), clamped into the unlocked region so the spot is valid.
    const biome = supplyPostAt(game.world, game.player.x, game.player.y);
    const post = biome ? SUPPLY_POSTS.find((p) => p.biome === biome) : undefined;
    if (post) {
      const exit = supplyExitPosition(post);
      clampToUnlocked(game.world, exit.x, exit.y, PLAYER.radius, exitOut);
      game.player.x = exitOut.x;
      game.player.y = exitOut.y;
    }
  } else if (!shopOpen && supplyPostAt(game.world, game.player.x, game.player.y) !== null) {
    // Walked into a zone with the panel closed → open it.
    shopPanel.refresh(journal, game.bait);
    shopPanel.setOpen(true);
  }
  shopWasOpen = shopPanel.isOpen();

  // Render the interpolated state. Renderers read prev+current; never mutate.
  entities.sync(game, alpha, dt, l2Frozen); // dt + freeze drive the CJ1 walk cycle (frozen → neutral)
  // Frozen (L2) scenes snap the camera to the player so the capture is byte-stable (the normal
  // exponential ease never settles — the screenshot would drift forever). No effect on play.
  scene.updateFollow(game, alpha, dt, l2Frozen);
  scene.render();
  hud.update(game);
  hud.setCredits(journal.credits); // §12 1a — the persistent balance (cheap text set)
  timeIndicator.update(game.dayPhase, game.timeSec);
  // Atmosphere A1: feed the live biome + phase to the ambient soundscape (a no-op until the
  // gesture starts it, and when nothing changed — zero per-frame work in the common case).
  ambient?.setScene(game.currentBiome, game.dayPhase);

  // L2: signal first-frame-ready once, so Playwright waits before capturing.
  if (!renderReadySignalled && app) {
    renderReadySignalled = true;
    signalRenderReady(app);
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
