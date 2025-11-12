# Testing Strategy

This project uses a two-tier testing approach. Before running any suite, complete the Orientation Path in [`docs/project_overview.md`](project_overview.md#orientation-path) so you gather the canonical commands and logging steps.

## 1. Unit/Integration Tests (Vitest)

**Location**: `src/**/*.test.ts`, `src/**/*.integration.test.ts`

**Purpose**: Fast, lightweight tests that verify logic and module interactions

**Characteristics**:
- Run in Node.js with jsdom environment
- Heavy mocking of DOM, canvas, and browser APIs
- Suppress expected warnings/errors
- Fast execution (< 1 second)
- No browser required

**What to test here**:
- State management logic
- Data transformations
- API client functions
- Module interactions
- Error handling
- Business logic

**Run**: `npm test` or `npm run test:watch`

## 2. End-to-End Tests (Playwright)

**Location**: `e2e/**/*.spec.ts`

**Purpose**: Real browser tests that verify actual functionality

**Characteristics**:
- Run in real browsers (Chromium, Firefox, WebKit)
- Real DOM rendering
- Real canvas operations
- Real image loading
- Real user interactions
- Slower execution (seconds per test)

**What to test here**:
- Image loading from URLs/files
- Canvas rendering
- Drawing interactions
- Zoom/pan functionality
- UI interactions
- Complete user workflows
- Cross-browser compatibility

**Run**: 
- `npm run test:e2e:ci` - Run all E2E tests headlessly (recommended for local/CI automation). Produces responsive header screenshots + JSON metrics under `frontend/playwright-report/data/`.
- `npm run test:e2e` - Run all E2E tests
- `npm run test:e2e:ui` - Run with Playwright UI
- `npm run test:e2e:debug` - Debug mode
- `npm run test:all` - Run both unit and E2E tests

## Test Organization

```
frontend/
├── src/
│   ├── **/*.test.ts              # Unit tests
│   ├── **/*.integration.test.ts   # Integration tests
│   └── test/
│       └── setup.ts              # Test setup (console suppression, etc.)
├── e2e/
│   └── *.spec.ts                  # E2E tests (Playwright)
├── vitest.config.ts               # Vitest configuration
└── playwright.config.ts          # Playwright configuration
```

## Console Suppression

The test setup (`src/test/setup.ts`) automatically suppresses:
- Expected warnings (container size, canvas not initialized)
- Debug console.log statements (transform calculations, render calls)
- Expected errors (test error scenarios)

To enable console output for debugging:
```typescript
import { setConsoleSuppression } from '../test/setup';

setConsoleSuppression(false);
```

## Best Practices

1. **Unit/Integration Tests**: Mock everything, test logic
2. **E2E Tests**: Use real browser, test actual functionality
3. **Responsive QA**: The Playwright “Mobile Responsiveness” suite enforces the header layout across desktop/tablet/large-phone/small-phone and emits cropped screenshots for review.
4. **Keep tests fast**: Unit tests should run in milliseconds
5. **Keep tests isolated**: Each test should be independent
6. **Suppress noise**: Use setup.ts to filter expected warnings
7. **Test user workflows**: Use E2E for complete user journeys

## Running Tests

```bash
# Unit/Integration tests only (fast)
npm test

# E2E tests only (slower, requires dev server)
# (use this when you need to see the browser)
npm run test:e2e

# Headless CI-friendly E2E run (preferred for automation)
npm run test:e2e:ci

# All tests
npm run test:all

# Watch mode for development
npm run test:watch
```
