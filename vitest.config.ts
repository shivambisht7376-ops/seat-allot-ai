import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout:  30_000,   // 30 s per test (auto-allocate hits many DB rows)
    hookTimeout:  30_000,   // 30 s for beforeAll / afterAll
    include:      ['tests/**/*.test.ts'],
    reporters:    ['verbose'],
  },
});
