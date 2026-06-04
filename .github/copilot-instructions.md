# Wild Trails — Copilot Review Instructions
Browser 3D game. Vite + TypeScript + Three.js. No React, no SSR. No backend.
Flag on review:
- Any 'three' import under src/game/ (must be pure, Node-testable)
- DOM/input handling under src/game/ (it belongs in src/input/)
- Renderers mutating game state (rendering reads, never writes)
- Magic numbers outside utils/constants.ts
- Object allocation inside the rAF loop
- Touch controls missing parity with keyboard
- Committed art/audio assets (geometry is procedural, audio is synthesized)
- Network calls / fetch / secrets (only persistence is localStorage)
- localStorage access not guarded by try/catch (Safari private mode must not crash)
- Implicit any
- CommonJS require() (must be ESM for Vite)
