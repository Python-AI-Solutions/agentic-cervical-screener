# Testing Strategy

This project uses a three-tier testing approach. Before running any suite, complete the Orientation Path in [`docs/project_overview.md`](project_overview.md#orientation-path) so you gather the canonical commands and logging steps.

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
- `npm run test:e2e:ci` - Run all E2E tests headlessly (recommended for local/CI automation). Produces responsive header screenshots + JSON metrics under `frontend/playwright-artifacts/`.
- `npm run test:e2e` - Run all E2E tests
- `npm run test:e2e:ui` - Run with Playwright UI
- `npm run test:e2e:debug` - Debug mode
- `pixi run npm run test:vlm` - Run the local LLava/Ollama audits for docs + viewer screenshots (requires Apple Silicon with ≥16 GB RAM)
- `npm run test:all` - Run all three stacks (unit/integration, application E2E, local VLM)

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

## VLM & Metrics

- `pixi run npm run test:vlm`: Runs the LLava/Ollama review (via the `llm` CLI) against the latest Playwright screenshots/JSON and fails on medium+ issues.
- `npm run docs:metrics`: Verifies onboarding success rate (≥90% over last 10 log rows) and documentation freshness (<30 days since `last_reviewed`).
- Install [Ollama](https://ollama.com/download) locally and pull at least one multimodal model (for example `ollama pull llava`). You can override the default model by setting `VLM_MODEL`.
- Playwright artifacts are written to `frontend/playwright-artifacts/<suite>` by default. Override the location with `PLAYWRIGHT_ARTIFACT_ROOT` (for the Playwright run) or run `pixi run npm run vlm:docs -- --screenshots <dir>` when you need to analyze a custom directory.

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

# VLM audits (docs + viewer; run inside Pixi)
pixi run npm run test:vlm

# All tests (unit + app E2E + VLM)
npm run test:all

# Watch mode for development
npm run test:watch
```
