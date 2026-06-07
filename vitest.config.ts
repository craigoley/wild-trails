import { defineConfig } from 'vitest/config';

// Vitest runs the L1/unit suite ONLY: `.test.ts` files under `src/`. This deliberately
// scopes it so it does NOT pick up the Playwright L2 e2e specs (`e2e/*.spec.ts`, which
// import `@playwright/test` and are run by Playwright, not Vitest).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
