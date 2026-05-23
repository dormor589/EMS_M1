// Source: docs/spec_brief.txt §3.2 — Vitest preferred (Vite-native)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom provides browser globals (localStorage, window, etc.)
    environment: 'jsdom',
    globals: true,
    // Test files: src/**/__tests__/*.test.js or client/tests/
    include: ['src/**/__tests__/**/*.test.js', 'tests/**/*.test.js'],
  },
});
