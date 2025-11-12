import { defineConfig, devices } from '@playwright/test';

const DOCS_SPEC = /docs-overview\.spec\.ts/;
const VIEWER_SPEC = /viewer-responsive\.spec\.ts/;

/**
 * Playwright configuration for E2E tests
 * These tests run in a real browser and test actual functionality
 * 
 * Separation of concerns:
 * - Unit/Integration tests (Vitest): Fast, mocked, test logic
 * - E2E tests (Playwright): Real browser, test actual functionality
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Reduce timeout for faster feedback in dev
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      testIgnore: [DOCS_SPEC, VIEWER_SPEC],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-safari',
      testIgnore: [DOCS_SPEC, VIEWER_SPEC],
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'docs-overview-desktop',
      testMatch: DOCS_SPEC,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1400, height: 900 },
        screenshot: 'on',
        video: 'off',
      },
    },
    {
      name: 'docs-overview-tablet',
      testMatch: DOCS_SPEC,
      use: {
        ...devices['iPad Pro 11'],
        screenshot: 'on',
        video: 'off',
      },
    },
    {
      name: 'docs-overview-large-phone',
      testMatch: DOCS_SPEC,
      use: {
        ...devices['Pixel 5'],
        screenshot: 'on',
        video: 'off',
      },
    },
    {
      name: 'docs-overview-small-phone',
      testMatch: DOCS_SPEC,
      use: {
        ...devices['iPhone SE'],
        screenshot: 'on',
        video: 'off',
      },
    },
    {
      name: 'viewer-desktop',
      testMatch: VIEWER_SPEC,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1400, height: 900 },
        screenshot: 'on',
        video: 'off',
      },
    },
    {
      name: 'viewer-tablet',
      testMatch: VIEWER_SPEC,
      use: {
        ...devices['iPad Pro 11'],
        screenshot: 'on',
        video: 'off',
      },
    },
    {
      name: 'viewer-large-phone',
      testMatch: VIEWER_SPEC,
      use: {
        ...devices['Pixel 5'],
        screenshot: 'on',
        video: 'off',
      },
    },
    {
      name: 'viewer-small-phone',
      testMatch: VIEWER_SPEC,
      use: {
        ...devices['iPhone SE'],
        screenshot: 'on',
        video: 'off',
      },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
