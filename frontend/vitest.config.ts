import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.integration.test.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**', '**/dist/**'],
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Suppress console output unless test fails
    silent: false,
    // Reduce noise from console.log in tests
    logHeapUsage: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});

