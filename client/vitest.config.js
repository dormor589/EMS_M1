// Source: docs/spec_brief.txt §3.2 — Vitest preferred (Vite-native)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom provides browser globals (localStorage, window, document, etc.)
    environment: 'jsdom',
    globals: true,
    // Test files: src/**/__tests__/*.test.{js,jsx}
    include: ['src/**/__tests__/**/*.test.{js,jsx}', 'tests/**/*.test.{js,jsx}'],
    // Load @testing-library/jest-dom matchers globally for all tests
    setupFiles: ['./src/test-setup.js'],
  },
});
