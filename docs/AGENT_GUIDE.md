# Agent Development Guide

This guide helps AI coding assistants understand the project structure, conventions, and how to contribute effectively.

## Project Overview

**Agentic Cervical Screener** is a web-based medical imaging application for cervical cytology analysis. It combines:
- **Backend**: FastAPI (Python) with PyTorch YOLO model for cell detection/classification
- **Frontend**: TypeScript/Vite with Tailwind CSS, NiiVue for image viewing
- **Architecture**: Monorepo with Python package (`agentic_cervical_screener/`) and frontend (`frontend/`)

## Project Structure

```
agentic-cervical-screener/
├── agentic_cervical_screener/    # Python package (backend)
│   ├── main.py                   # FastAPI app
│   ├── model_loader.py           # Model initialization
│   └── models/                   # PyTorch model files
├── frontend/                     # Frontend application
│   ├── src/                      # Source code
│   │   ├── viewer/              # Image viewer modules
│   │   ├── services/            # API clients
│   │   ├── components/         # React/TSX components
│   │   └── styles/              # CSS/Tailwind styles
│   ├── e2e/                     # Playwright E2E tests
│   └── dist/                    # Build output (gitignored)
├── public/                       # Static assets (images, mock data)
├── tests/                        # Python backend tests
├── deploy/                       # Kubernetes deployment configs
└── pyproject.toml               # Python project config
```

## Key Conventions

### Code Organization

1. **Python Backend**:
   - All Python code in `agentic_cervical_screener/` package
   - FastAPI routes in `main.py`
   - Model loading in `model_loader.py`
   - Tests in `tests/` directory

2. **Frontend**:
   - TypeScript source in `frontend/src/`
   - Viewer logic split into modules (`StateManager`, `CanvasManager`, etc.)
   - UI components use Tailwind CSS Plus Elements
   - Tests: Unit/Integration (Vitest) + E2E (Playwright)

### Testing Strategy

**Two-tier approach**:
- **Unit/Integration (Vitest)**: Fast, mocked tests for logic (`src/**/*.test.ts`, `src/**/*.integration.test.ts`)
- **E2E (Playwright)**: Real browser tests for actual functionality (`e2e/**/*.spec.ts`)

**Key principles**:
- Mock DOM/canvas/browser APIs in unit tests
- Use real browser for E2E tests
- Suppress expected warnings in test setup
- Keep unit tests fast (< 1s)

### Styling

- **Tailwind CSS v3** with custom medical theme
- **Tailwind Elements** for pre-built components
- **Component wrapper pattern**: Create thin wrappers around Elements for type safety
- Custom classes in `frontend/src/styles/main.css` (`@layer components`)

### State Management

- Centralized state in `StateManager.ts`
- Reactive updates via getters/setters
- No external state library (vanilla JS/TS)

## Development Workflow

### Running the Application

```bash
# Backend + Frontend (dev mode)
pixi run dev

# Frontend only (dev mode)
cd frontend && npm run dev

# Backend only
pixi run start
```

### Testing

```bash
# Unit/Integration tests (fast)
cd frontend && npm test

# E2E tests (requires dev server)
cd frontend && npm run test:e2e

# Headless CI-friendly E2E run (preferred for automation)
cd frontend && npm run test:e2e:ci

# All tests
cd frontend && npm run test:all
```

**Note**: E2E tests start a dev server automatically. Prefer `npm run test:e2e:ci` for headless runs so the browser UI doesn't block the terminal. If you need the interactive UI, use `npm run test:e2e:ui` or `npx playwright test --ui`.

### Documentation Evidence & Metrics

Certain documentation-focused features require extra validation:

```bash
# Markdown structure checks (Vitest)
cd frontend && npm run docs:test

# Responsive renders + JSON artifacts
cd frontend && npm run docs:e2e

# MLX VLM audit (Apple Silicon w/ ≥16 GB RAM)
cd frontend && npm run docs:vlm-review

# Onboarding + freshness metrics
cd frontend && npm run docs:metrics
```

**Prerequisites**
- Install Apple’s MLX runtime and model once (`pip install mlx-lm` then allow `mlx_lm` to download `mlx-community/llava-phi-3-mini-4k`).
- Maintain `docs/metrics/onboarding-log.csv` after each mentor session so the metrics script can compute the ≥90 % success threshold.

### Building

```bash
# Frontend build
cd frontend && npm run build

# Backend package
pixi run build
```

## Common Tasks

### Adding a New Feature

1. **Backend API**:
   - Add route in `agentic_cervical_screener/main.py`
   - Add tests in `tests/test_api.py`
   - Update API docs if needed

2. **Frontend Feature**:
   - Create module in `frontend/src/viewer/` or component in `frontend/src/components/`
   - Add unit tests in same directory (`*.test.ts` or `*.integration.test.ts`)
   - Add E2E test if it requires browser interaction (`e2e/*.spec.ts`)

### Modifying UI

1. Use Tailwind utility classes
2. Add custom styles in `frontend/src/styles/main.css` (`@layer components`)
3. Use Tailwind Elements components via wrappers in `frontend/src/components/ui/`
4. Test responsive behavior (mobile/desktop)

### Debugging

- **Backend**: Check FastAPI logs, use `pixi run dev` for hot reload
- **Frontend**: Browser dev tools, Vite HMR
- **Tests**: Run specific test file: `npm test -- path/to/test.ts`
- **E2E**: Use `npm run test:e2e:debug` for Playwright inspector

## Important Files

### Configuration Files

- `pyproject.toml`: Python dependencies, scripts, tool configs
- `frontend/package.json`: Frontend dependencies and scripts
- `frontend/vite.config.ts`: Vite build config, proxy settings
- `frontend/vitest.config.ts`: Vitest test config
- `frontend/playwright.config.ts`: Playwright E2E config
- `frontend/tailwind.config.js`: Tailwind CSS config

### Key Source Files

- `agentic_cervical_screener/main.py`: FastAPI app, routes, static file serving
- `frontend/src/viewer/index.ts`: Main viewer orchestration
- `frontend/src/viewer/StateManager.ts`: Centralized state
- `frontend/index.html`: Main HTML entry point

## Code Style

### Python

- Follow PEP 8
- Use type hints
- Format with `ruff format`
- Lint with `ruff check`

### TypeScript

- Use TypeScript strict mode
- Prefer interfaces over types
- Use async/await, not promises
- Format with Prettier (if configured)

## Common Pitfalls

1. **Don't commit build artifacts**: `frontend/dist/`, `frontend/playwright-report/`, `frontend/test-results/` are gitignored
2. **Don't modify `src/` directory**: It's the old location, code is now in `agentic_cervical_screener/`
3. **E2E tests need dev server**: They start automatically, don't run manually
4. **Mock everything in unit tests**: Don't use real DOM/canvas unless testing actual rendering
5. **Tailwind transforms are matrices**: Browsers compute `translateX(-100%)` as `matrix(...)`, check bounding boxes instead

## Environment Variables

- `API_BASE`: Frontend API base URL (set via `window.__ENV__` in production)
- Mock mode: Determined by `window.location.hostname === 'localhost'` in dev

## Dependencies

### Backend (Python)
- FastAPI: Web framework
- PyTorch: ML model runtime
- Ultralytics: YOLO model

### Frontend (Node.js)
- Vite: Build tool
- TypeScript: Type safety
- Tailwind CSS: Styling
- NiiVue: Medical image viewer
- Vitest: Unit/integration testing
- Playwright: E2E testing

## Getting Help

- Check `README.md` for user-facing documentation
- Check `docs/TESTING.md` for testing details
- Check `frontend/e2e/README.md` for E2E test quick reference
- Review existing code patterns before adding new features
