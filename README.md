# Wild Trails

Real-time **roaming isometric creature-catching game** — wander the wild, track
animals, and catch them. Built with TypeScript + Three.js + Vite. Part of
**OleyArcade**.

It's a static, client-side game: **no backend, no accounts, no network calls.**
Your progress — a persistent **Field Journal** (the creature dex) — lives in your
browser's `localStorage`.

> **Status:** Phase 0 scaffold. This is movement + the isometric follow-camera +
> the persistence shape + a placeholder render. The creature-catching gameplay
> (species, roaming animal AI, catch mechanic, tools/bait) lands in later phased
> PRs. See [`CLAUDE.md`](./CLAUDE.md) for the architecture and the hard rules.

## Develop

```bash
nvm use          # Node 24.x (pinned in .nvmrc / package.json engines)
npm install
npm run dev      # local dev server
npm run build    # type-check + production build
npm run test     # Vitest on the pure game layer
```

## Controls

- **Desktop:** `WASD` / arrow keys to roam.
- **Mobile:** drag anywhere for the on-screen joystick.

## Architecture (short version)

A strict split keeps the simulation testable in Node:

- `src/game/` — pure TypeScript, **zero** three.js imports, unit-tested.
- `src/input/` — the DOM/touch adapter (keyboard + joystick at parity).
- `src/rendering/` — the three.js layer; reads game state, never mutates it.
- `src/state/` — the `localStorage` Field Journal.
- `src/utils/` — all tuning constants + pure math helpers.

The loop runs a fixed-timestep simulation with render interpolation, viewed
through an orthographic isometric camera. Full rules in
[`CLAUDE.md`](./CLAUDE.md).

## License

[MIT](./LICENSE)
