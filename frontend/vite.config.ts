import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: '.',
  publicDir: '../public',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@docs': path.resolve(__dirname, '..', 'docs'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    fs: {
      allow: [path.resolve(__dirname), path.resolve(__dirname, '..')],
    },
    // Proxy API requests to FastAPI backend if running
    proxy: {
      '/cases': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/v1': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
