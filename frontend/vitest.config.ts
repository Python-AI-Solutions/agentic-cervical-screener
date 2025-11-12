import { defineConfig } from 'vitest/config';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const resolvePackage = (name: string) => require.resolve(name);

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.integration.test.ts', '../docs/__tests__/**/*.test.ts'],
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
      '@docs': path.resolve(__dirname, '..', 'docs'),
      'gray-matter': resolvePackage('gray-matter'),
      'remark-parse': resolvePackage('remark-parse'),
      'remark-gfm': resolvePackage('remark-gfm'),
      unified: resolvePackage('unified'),
      'unist-util-visit': resolvePackage('unist-util-visit'),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname), path.resolve(__dirname, '..')],
    },
  },
});
