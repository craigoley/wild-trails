# Wild Trails

Real-time **roaming isometric creature-catching game** — wander the wild, track
animals, and catch them. TypeScript + Three.js + Vite. Deployed to Vercel as a
static site. Part of OleyArcade.

A persistent **Field Journal** (the creature dex) is kept in `localStorage`.
There is **no backend, no accounts, and no network calls** — this is a static,
client-side game; the ONLY persistence is `localStorage`.

## Architecture
- `src/game/` — pure TypeScript, ZERO three.js imports, Node-testable
- `src/input/` — the impure DOM/touch input adapter (writes the pure intent)
- `src/rendering/` — three.js layer, reads game state, never mutates it
- `src/state/` — `localStorage` persistence (the Field Journal)
- `src/audio/` — Web Audio API, synthesized only, no audio files
- `src/utils/` — constants (all tuning) + pure math helpers

Loop: `input -> game.update() -> render -> repeat`, on a fixed SIM_DT timestep
with render interpolation (deterministic sim, smooth at any refresh rate).

The iso camera, dead-zone follow, and the input→world rotation are ported from
the OleyArcade fleet (rogue-descent) — match them, don't reinvent.

## Hard rules
- NEVER import `three` anywhere under `src/game/` — it stays Node-testable.
  DOM/touch input lives in `src/input/`, NOT `src/game/`.
- The rendering layer READS game state and NEVER mutates it.
- ALL tuning constants in `utils/constants.ts` — no magic numbers anywhere else.
- No external art assets — geometry is procedural (zero-assets).
- No external audio files — sound is synthesized via the Web Audio API.
- Bounded object pools; NO per-frame allocation in the loop.
- Mobile required: touch controls at PARITY with keyboard. This is a roaming
  game — it needs an on-screen joystick on mobile, feeding the same intent
  through the same iso rotation as the keys.
- `?debug=1` funnel telemetry on any multi-step pipeline. When the catch loop
  lands, instrument counts at each step: `spawn -> roam -> encounter ->
  catch-attempt -> resolve`.
- Diagnose before patching; tests pin BEHAVIOR, not "it ran".
- Node pinned to `24.x` (engines + `.nvmrc`).
- `npm run build` must pass before any PR.

## Testing
Vitest on the pure `src/game/` layer. Tests in `src/game/__tests__/`. No WebGL
tests needed — game logic is pure. The iso input-mapping regression (pressing
"up" must project straight up the screen under the 45° yaw) is pinned in
`player.test.ts` by projecting velocity through the real camera basis — keep it.

## Deployment
Vercel auto-deploys on merge to main. Framework preset: Vite. No server routes,
no API endpoints — static client app. The `wild-trails.vercel.app` subdomain is
confirmed at first deploy; on a collision, fall back to a hyphenated/aliased
production domain.

## PR workflow
Branch from latest main, PR, never commit to main directly. Visual/feel PRs open
as **DRAFT** — they need a device playtest before merge. The auto-review +
auto-merge process layer (claude-review, CodeQL/OSV/Dependabot, pr-pipeline,
Copilot ruleset) lands in PR #2; until then PRs are merged manually.

## Roadmap (phased — NOT in this scaffold)
Catch mechanic, species data, roaming animal AI, spawn system, tools/bait, and
stealth/detection each arrive in their own later PR — each adds its own block to
`constants.ts` and its own pure module under `src/game/`. This scaffold is
movement + iso camera + persistence shape + a placeholder render only.
