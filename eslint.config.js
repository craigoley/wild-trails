// ESLint flat config (eslint.config.js). typescript-eslint "recommended" (syntactic — no type
// info needed, so it's fast and CI-stable). Build (tsc) handles type errors;
// this catches lint-class issues (unused vars, unsafe patterns, etc).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  // Generated / vendored output is never linted.
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // The game ships to the browser; tests run under jsdom — both browser-global.
    languageOptions: {
      globals: { ...globals.browser },
    },
    // Additive bug-catching hardening (security-hardening pass) — zero violations
    // in the current tree, so this only guards against NEW bad patterns. no-debugger
    // is already on via js.recommended; console is left alone (the one console.info
    // is an intentional journal diagnostic). Not stylistic churn — defensive only.
    rules: {
      'no-var': 'error', // const/let only — no hoisting/scope footguns
      'no-alert': 'error', // a canvas game never uses alert/confirm/prompt
    },
  },
);
