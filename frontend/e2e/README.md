# Playwright E2E Tests

These tests run in a real browser and test actual functionality.

For comprehensive testing documentation, see `docs/TESTING.md` in the project root.

## Quick Start

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI (interactive)
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug
```

## Test Structure

- **e2e/viewer.spec.ts**: Main viewer functionality tests
  - Image loading
  - Case loading
  - UI interactions
  - Drawing functionality
  - Zoom/pan functionality

