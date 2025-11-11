# Migration Plan: Single Page App → Well-Packaged Web App with Tests

## Current State Assessment

### ✅ What's Already Done

1. **Frontend Structure**
   - TypeScript migration started (`src/frontend/src/`)
   - Vite build system configured (`vite.config.ts`)
   - TypeScript configuration (`tsconfig.json`)
   - Module structure: `services/`, `viewer/`, `styles/`
   - One test file exists (`overlayAdapters.test.ts`)

2. **Backend**
   - FastAPI application (`src/main.py`)
   - Backend tests exist (`tests/test_api.py`, `tests/test_integration.py`, `tests/test_model.py`)
   - Proper project structure with `pyproject.toml`

3. **Build System**
   - Vite configured for frontend
   - Pixi for Python dependency management
   - Dockerfile exists

### ❌ What Needs Work

1. **Project Structure**
   - **Frontend location**: Currently in `src/frontend/` → should be `frontend/`
   - **Python package**: Currently in `src/` → should be `agentic_cervical_screener/`
   - **Models location**: Currently in `src/models/` → should be in Python package

2. **Frontend Architecture**
   - **Monolithic files**: `src/frontend/src/viewer/index.ts` is 1834 lines - needs refactoring
   - **HTML/CSS separation**: `index.html` has 1290 lines with inline styles - should use Tailwind CSS
   - **Missing component structure**: No clear separation of concerns
   - **Global state management**: Heavy reliance on global variables
   - **No Tailwind CSS**: Need to migrate from custom CSS to Tailwind CSS Plus with Elements

3. **Production Integration**
   - FastAPI doesn't serve the built frontend (`dist/`)
   - No clear production build pipeline
   - Frontend dist not included in Docker image

4. **Testing**
   - Only 1 frontend test file (`overlayAdapters.test.ts`)
   - No E2E tests
   - No integration tests for frontend-backend communication
   - Missing test coverage for viewer logic

5. **Code Organization**
   - HTML template mixed with business logic
   - CSS should be replaced with Tailwind CSS Plus
   - Missing proper error handling patterns
   - No clear state management strategy

6. **Documentation**
   - Missing frontend architecture docs
   - No testing guide for frontend
   - Build/deployment process not documented

---

## Migration Plan

### Phase 0: Project Restructure (Priority: Critical)

#### 0.1 Restructure Python Package
- [ ] Create `agentic_cervical_screener/` directory at root
- [ ] Move `src/main.py` → `agentic_cervical_screener/main.py`
- [ ] Move `src/model_loader.py` → `agentic_cervical_screener/model_loader.py`
- [ ] Move `src/models/` → `agentic_cervical_screener/models/`
- [ ] Update all imports in Python code
- [ ] Update `pyproject.toml` to reference new package location
- [ ] Update `tests/` to import from `agentic_cervical_screener`
- [ ] Update Dockerfile and deployment configs

#### 0.2 Restructure Frontend
- [ ] Move `src/frontend/` → `frontend/` (at root level)
- [ ] Update all paths in `vite.config.ts`
- [ ] Update `tsconfig.json` paths
- [ ] Update FastAPI static file serving paths
- [ ] Update Dockerfile frontend build paths

### Phase 1: Foundation & Structure (Priority: High)

#### 1.1 Set Up Tailwind CSS Plus with Elements
- [ ] Install Tailwind CSS Plus dependencies (`tailwindcss`, `@tailwindcss/vite`, etc.)
- [ ] Configure Tailwind CSS Plus in `frontend/tailwind.config.js`
- [ ] Set up Tailwind Elements system (using Elements blocks from Plus subscription)
- [ ] Create `frontend/src/styles/main.css` with Tailwind directives
- [ ] Migrate existing CSS to Tailwind utility classes
- [ ] Use Tailwind Elements components for:
  - Header/Navigation (use Elements navbar/header blocks)
  - Sidebar (use Elements sidebar/navigation blocks)
  - Buttons (use Elements button components)
  - Forms/Inputs (use Elements form components)
  - Modals/Dialogs (use Elements modal components)
  - Layer toggles (use Elements toggle/switch components)
- [ ] Create custom Tailwind theme for medical/dark theme
- [ ] Update Vite config to process Tailwind CSS

**Tailwind Elements Strategy:**
- Use Elements UI blocks as base components (navbar, sidebar, buttons, forms)
- Customize Elements components with Tailwind utilities for medical theme
- Create component wrappers in `frontend/src/components/ui/` that use Elements
- Maintain custom canvas/viewer styling (Elements doesn't cover canvas rendering)
- Use Elements for all standard UI patterns (headers, sidebars, forms, modals)

#### 1.2 Refactor Monolithic Viewer File
- [ ] Break down `frontend/src/viewer/index.ts` (1834 lines) into:
  - `frontend/src/viewer/CanvasManager.ts` - Canvas sizing/rendering
  - `frontend/src/viewer/ImageLoader.ts` - Image loading logic
  - `frontend/src/viewer/OverlayRenderer.ts` - Overlay drawing
  - `frontend/src/viewer/DrawingManager.ts` - Drawing/ROI functionality
  - `frontend/src/viewer/ZoomPanManager.ts` - Zoom/pan controls
  - `frontend/src/viewer/StateManager.ts` - State management
  - `frontend/src/viewer/index.ts` - Main orchestrator (thin)

#### 1.3 Create Component Structure
- [ ] Create `frontend/src/components/` directory structure:
  - `frontend/src/components/ui/` - Tailwind Elements-based components
  - `frontend/src/components/layout/` - Layout components (Header, Sidebar, etc.)
  - `frontend/src/components/viewer/` - Viewer-specific components
- [ ] Extract UI components using Tailwind Elements:
  - `Header.ts` - Use Elements navbar component
  - `Sidebar.ts` - Use Elements sidebar/navigation component
  - `Viewer.ts` - Main viewer component (custom canvas)
  - `LayerControls.ts` - Use Elements toggle/switch components
  - `StatusBar.ts` - Use Elements badge/alert components
  - `Button.ts` - Wrapper around Elements button
  - `Modal.ts` - Wrapper around Elements modal

#### 1.4 State Management
- [ ] Create `frontend/src/store/` directory
- [ ] Implement state management (consider Zustand or simple class-based)
- [ ] Move global variables to state store
- [ ] Create typed state interfaces

### Phase 2: Production Integration (Priority: High)

#### 2.1 FastAPI Frontend Serving
- [ ] Update `agentic_cervical_screener/main.py` to serve built frontend from `frontend/dist/`
- [ ] Add catch-all route for SPA routing
- [ ] Ensure static assets are properly served
- [ ] Update Dockerfile to build frontend and copy dist

#### 2.2 Build Pipeline
- [ ] Update `frontend/package.json` scripts for production builds
- [ ] Add frontend build step to Dockerfile (build from `frontend/` directory)
- [ ] Ensure environment variables are properly injected
- [ ] Test production build locally
- [ ] Optimize Tailwind CSS for production (purge unused classes)

#### 2.3 Environment Configuration
- [ ] Create `.env.example` files for both frontend and backend
- [ ] Document environment variables
- [ ] Ensure proper API base URL configuration
- [ ] Add runtime environment detection

### Phase 3: Testing Infrastructure (Priority: Medium)

#### 3.1 Unit Tests
- [ ] Set up Vitest configuration properly in `frontend/`
- [ ] Add tests for:
  - `frontend/src/services/classifyClient.ts`
  - `frontend/src/services/cqaiClient.ts`
  - `frontend/src/viewer/overlayAdapters.ts` (already exists, expand)
  - `frontend/src/viewer/roiNav.ts`
  - New refactored modules
  - Tailwind Elements component wrappers

#### 3.2 Component Tests
- [ ] Add component testing setup (Vitest + @testing-library)
- [ ] Test UI components in isolation
- [ ] Test user interactions

#### 3.3 Integration Tests
- [ ] Add tests for frontend-backend communication
- [ ] Test API client error handling
- [ ] Test image loading workflows
- [ ] Test classification flow

#### 3.4 E2E Tests
- [ ] Set up Playwright (already in dependencies)
- [ ] Create E2E test suite:
  - Load case
  - Classify image
  - Draw ROI
  - Toggle layers
  - Download image

#### 3.5 Test Coverage
- [ ] Set up coverage reporting
- [ ] Aim for >70% coverage on critical paths
- [ ] Add coverage to CI/CD

### Phase 4: Code Quality & Documentation (Priority: Medium)

#### 4.1 TypeScript Improvements
- [ ] Remove `@ts-nocheck` from files
- [ ] Add proper type definitions
- [ ] Enable stricter TypeScript checks
- [ ] Add JSDoc comments for public APIs

#### 4.2 Error Handling
- [ ] Implement consistent error handling
- [ ] Add error boundaries/components
- [ ] User-friendly error messages
- [ ] Error logging/reporting

#### 4.3 Code Organization
- [ ] Create `frontend/src/types/` for shared types
- [ ] Create `frontend/src/utils/` for utilities
- [ ] Create `frontend/src/constants/` for constants
- [ ] Create `frontend/src/components/ui/` for Tailwind Elements wrappers
- [ ] Remove duplicate code

#### 4.4 Documentation
- [ ] Add JSDoc to all public functions
- [ ] Create `docs/frontend/` directory
- [ ] Document architecture decisions
- [ ] Create developer guide
- [ ] Update README with frontend info

### Phase 5: Performance & Optimization (Priority: Low)

#### 5.1 Performance
- [ ] Add lazy loading for large components
- [ ] Optimize image loading
- [ ] Implement virtual scrolling if needed
- [ ] Add performance monitoring

#### 5.2 Bundle Size
- [ ] Analyze bundle size
- [ ] Code splitting
- [ ] Tree shaking verification
- [ ] Optimize dependencies

#### 5.3 Accessibility
- [ ] Add ARIA labels
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] Color contrast checks

---

## Implementation Order

### Week 1: Restructure & Tailwind Setup
1. Restructure Python package (`src/` → `agentic_cervical_screener/`)
2. Restructure frontend (`src/frontend/` → `frontend/`)
3. Set up Tailwind CSS Plus with Elements
4. Migrate CSS to Tailwind utilities
5. Create Tailwind Elements component wrappers

### Week 2: Refactoring & Components
1. Refactor viewer into smaller modules
2. Extract UI components using Tailwind Elements
3. Set up state management
4. Update FastAPI to serve from new frontend location

### Week 3: Production & Testing
1. FastAPI frontend serving
2. Build pipeline integration
3. Basic unit tests for new modules
4. Component tests

### Week 4: Testing & Quality
1. Integration tests
2. E2E tests setup
3. Error handling improvements
4. Documentation
5. TypeScript improvements
6. Performance optimization
7. Final testing

---

## File Structure Target

```
# Root level
├── agentic_cervical_screener/    # Python package
│   ├── __init__.py
│   ├── main.py                   # FastAPI app
│   ├── model_loader.py
│   ├── models/                   # ML models
│   │   ├── best.pt
│   │   └── best_prev.pt
│   └── ...
│
├── frontend/                      # Frontend application (at root)
│   ├── dist/                      # Built files (gitignored)
│   ├── public/                    # Static assets
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                # Tailwind Elements wrappers
│   │   │   │   ├── Button.ts
│   │   │   │   ├── Modal.ts
│   │   │   │   └── ...
│   │   │   ├── layout/            # Layout components
│   │   │   │   ├── Header.ts      # Uses Elements navbar
│   │   │   │   ├── Sidebar.ts     # Uses Elements sidebar
│   │   │   │   └── StatusBar.ts   # Uses Elements badges
│   │   │   └── viewer/            # Viewer-specific components
│   │   │       └── Viewer.ts
│   │   ├── services/              # API clients
│   │   │   ├── classifyClient.ts
│   │   │   └── cqaiClient.ts
│   │   ├── store/                 # State management
│   │   │   └── appStore.ts
│   │   ├── types/                 # TypeScript types
│   │   │   └── index.ts
│   │   ├── utils/                 # Utilities
│   │   │   └── ...
│   │   ├── constants/             # Constants
│   │   │   └── ...
│   │   ├── viewer/                # Viewer logic (refactored)
│   │   │   ├── CanvasManager.ts
│   │   │   ├── ImageLoader.ts
│   │   │   ├── OverlayRenderer.ts
│   │   │   ├── DrawingManager.ts
│   │   │   ├── ZoomPanManager.ts
│   │   │   ├── StateManager.ts
│   │   │   ├── overlayAdapters.ts
│   │   │   ├── roiNav.ts
│   │   │   └── index.ts
│   │   ├── styles/                # CSS files
│   │   │   ├── main.css           # Tailwind directives
│   │   │   └── niivue.css         # NiiVue-specific styles
│   │   └── main.ts                # Entry point
│   ├── tests/                     # Frontend tests
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   ├── index.html                 # Minimal HTML template
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js         # Tailwind CSS Plus config
│   └── postcss.config.js          # PostCSS config for Tailwind
│
├── tests/                         # Python tests (at root)
│   ├── test_api.py
│   ├── test_integration.py
│   └── test_model.py
│
├── public/                        # Static assets (at root)
│   ├── images/
│   ├── mock/
│   └── niivue/
│
├── pyproject.toml                # Python project config
├── Dockerfile
├── README.md
└── ...
```

---

## Success Criteria

- [ ] Python code properly packaged in `agentic_cervical_screener/`
- [ ] Frontend code properly organized in `frontend/`
- [ ] Tailwind CSS Plus configured and Elements system integrated
- [ ] Frontend builds successfully for production
- [ ] FastAPI serves frontend correctly from `frontend/dist/`
- [ ] All existing functionality works
- [ ] Test coverage >70% on critical paths
- [ ] No monolithic files >500 lines
- [ ] All CSS migrated to Tailwind utilities (no inline styles)
- [ ] Tailwind Elements components used for standard UI patterns
- [ ] TypeScript strict mode enabled
- [ ] E2E tests pass
- [ ] Documentation complete
- [ ] Docker build succeeds
- [ ] Production deployment works

---

## Risks & Mitigation

### Risk 1: Breaking existing functionality
- **Mitigation**: Comprehensive E2E tests before refactoring
- **Mitigation**: Incremental refactoring with tests at each step

### Risk 2: Large refactoring scope
- **Mitigation**: Break into small, manageable PRs
- **Mitigation**: Keep old code working while migrating

### Risk 3: Missing dependencies
- **Mitigation**: Audit dependencies early
- **Mitigation**: Document all dependencies

---

## Tailwind CSS Plus Elements Strategy

### Recommended Approach

1. **Use Elements UI Blocks as Foundation**
   - Leverage pre-built Elements components (navbar, sidebar, buttons, forms, modals)
   - Elements provides production-ready, accessible components
   - Customize with Tailwind utilities for medical/dark theme

2. **Component Wrapper Pattern**
   - Create thin wrappers in `frontend/src/components/ui/` around Elements components
   - Wrappers provide type safety and project-specific defaults
   - Example: `Button.ts` wraps Elements button with medical theme classes

3. **Custom Components Where Needed**
   - Canvas/viewer components remain custom (Elements doesn't cover canvas rendering)
   - Medical-specific UI patterns can be custom-built with Tailwind utilities
   - Layer controls, ROI drawing UI can use Elements as base

4. **Theme Customization**
   - Extend Tailwind theme in `tailwind.config.js` for medical color palette
   - Use Elements theme customization for consistent styling
   - Dark theme optimized for medical imaging workflows

5. **Elements Components to Use**
   - **Navigation**: Elements navbar for header
   - **Sidebar**: Elements sidebar/navigation for case management
   - **Buttons**: Elements button components (with medical theme)
   - **Forms**: Elements form components for image upload
   - **Modals**: Elements modal for label selection dialogs
   - **Toggles**: Elements toggle/switch for layer controls
   - **Badges**: Elements badge for status indicators
   - **Alerts**: Elements alert for error messages

### Benefits
- Faster development with pre-built, accessible components
- Consistent design system
- Better accessibility out of the box
- Easier maintenance with well-documented components
- Professional UI with minimal custom CSS

## Next Steps

1. Review and approve this plan
2. Create GitHub issues for each phase
3. Start with Phase 0 (project restructure)
4. Set up Tailwind CSS Plus and Elements
5. Set up CI/CD for automated testing
6. Begin incremental refactoring

