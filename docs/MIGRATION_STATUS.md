# Migration Status Summary

## Current State Overview

### ✅ Completed
- TypeScript setup with Vite
- Basic module structure (`services/`, `viewer/`, `styles/`)
- Backend tests exist
- One frontend test (`overlayAdapters.test.ts`)

### ⚠️ Critical Issues

1. **Project Structure**
   - Frontend in wrong location: `src/frontend/` → should be `frontend/`
   - Python code in wrong location: `src/` → should be `agentic_cervical_screener/`
   - Models in wrong location: `src/models/` → should be in Python package

2. **Monolithic Code**
   - `src/frontend/src/viewer/index.ts`: **1,834 lines** - needs refactoring
   - `src/frontend/index.html`: **1,290 lines** with inline CSS - needs Tailwind CSS migration

3. **Production Not Configured**
   - FastAPI doesn't serve built frontend (`dist/`)
   - No production build integration
   - Dockerfile doesn't build frontend

4. **Missing Tests**
   - Only 1 frontend test file
   - No E2E tests
   - No integration tests for frontend-backend

5. **Code Organization**
   - Global variables everywhere
   - No state management
   - HTML/CSS mixed with logic
   - No Tailwind CSS Plus setup

## Immediate Next Steps (Priority Order)

### Phase 0: Project Restructure (Critical - Do First)

#### 1. Restructure Python Package
```bash
# Create new package structure
mkdir agentic_cervical_screener
mv src/main.py agentic_cervical_screener/
mv src/model_loader.py agentic_cervical_screener/
mv src/models agentic_cervical_screener/
# Update imports, pyproject.toml, tests, Dockerfile
```

#### 2. Restructure Frontend
```bash
# Move frontend to root
mv src/frontend frontend/
# Update vite.config.ts, tsconfig.json, FastAPI paths
```

### Phase 1: Tailwind CSS Plus Setup

#### 3. Install Tailwind CSS Plus
```bash
cd frontend
npm install -D tailwindcss @tailwindcss/vite postcss autoprefixer
npm install tw-elements  # Tailwind Elements
```

#### 4. Configure Tailwind
- Create `frontend/tailwind.config.js` with Elements integration
- Create `frontend/src/styles/main.css` with Tailwind directives
- Update `frontend/vite.config.ts` to use Tailwind plugin

#### 5. Migrate CSS to Tailwind
- Replace inline styles with Tailwind utility classes
- Use Tailwind Elements components for standard UI (navbar, sidebar, buttons, modals)
- Keep custom canvas/viewer styling

### Phase 2: Production Integration

#### 6. Fix FastAPI Frontend Serving
```python
# Update agentic_cervical_screener/main.py to serve dist/
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Add after existing mounts:
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith(("api", "v1", "healthz", "model-info", "cases", "images", "mock", "niivue")):
            return  # Let FastAPI handle API routes
        if os.path.exists(os.path.join(frontend_dist, full_path)):
            return FileResponse(os.path.join(frontend_dist, full_path))
        return FileResponse(os.path.join(frontend_dist, "index.html"))
```

#### 7. Update Dockerfile to Build Frontend
```dockerfile
# Add before Python setup
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

WORKDIR /app
# Then copy built dist to appropriate location
```

## Quick Wins (Can Do Today)

1. ✅ Restructure Python package (30 min)
2. ✅ Move frontend to root (15 min)
3. ✅ Install Tailwind CSS Plus (15 min)
4. ✅ Set up Tailwind config (30 min)
5. ✅ Migrate header/sidebar to Tailwind Elements (1 hour)

## Testing Strategy

### Unit Tests (Vitest)
- Test services in isolation
- Test utility functions
- Mock API calls
- Test Tailwind Elements component wrappers

### Component Tests
- Test UI components built with Tailwind Elements
- Test user interactions
- Use @testing-library

### Integration Tests
- Test API client → FastAPI
- Test image loading flow
- Test classification workflow

### E2E Tests (Playwright)
- Full user workflows
- Cross-browser testing
- Visual regression

## File Size Targets

| File | Current | Target |
|------|---------|--------|
| `viewer/index.ts` | 1,834 lines | <500 lines |
| `index.html` | 1,290 lines | <200 lines |
| `overlayAdapters.ts` | 212 lines | ✅ OK |
| `classifyClient.ts` | 80 lines | ✅ OK |

## Dependencies Status

✅ Already installed:
- `vitest` - Testing framework
- `@types/node` - TypeScript types
- `jsdom` - DOM environment for tests
- `playwright` - E2E testing (in pyproject.toml)

⚠️ Need to install:
- `tailwindcss` - Tailwind CSS Plus
- `@tailwindcss/vite` - Vite plugin
- `tw-elements` - Tailwind Elements components
- `@testing-library/dom` - Component testing
- `@testing-library/user-event` - User interaction testing

## Tailwind Elements Components to Use

- **Navigation**: Elements navbar for header
- **Sidebar**: Elements sidebar/navigation for case management
- **Buttons**: Elements button components
- **Forms**: Elements form components for image upload
- **Modals**: Elements modal for label selection dialogs
- **Toggles**: Elements toggle/switch for layer controls
- **Badges**: Elements badge for status indicators
- **Alerts**: Elements alert for error messages

## Estimated Timeline

- **Week 1**: Restructure + Tailwind CSS Plus setup
- **Week 2**: Refactoring + Components with Elements
- **Week 3**: Production integration + Testing
- **Week 4**: Comprehensive testing + Documentation

## Questions Resolved

1. ✅ **CSS approach**: Tailwind CSS Plus with Elements system
2. ✅ **Project structure**: Frontend at `frontend/`, Python at `agentic_cervical_screener/`
3. ✅ **Component strategy**: Use Tailwind Elements as foundation, wrap in TypeScript components

---

See `MIGRATION_PLAN.md` for detailed plan.

