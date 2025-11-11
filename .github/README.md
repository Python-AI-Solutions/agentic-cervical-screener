# GitHub Actions Workflows

This directory contains GitHub Actions workflows for CI/CD.

## Workflows

### `ci.yml` - Continuous Integration

Runs on every push and pull request to `main` branch.

**Jobs:**
1. **test-backend**: Python backend tests
   - Installs pixi and Python dependencies
   - Runs unit tests (`pixi run test`)
   - Runs integration tests (`pixi run test-integration`)
   - Generates coverage report
   - Uploads coverage to Codecov

2. **test-frontend**: Frontend tests
   - Sets up Node.js 20
   - Installs frontend dependencies (`npm ci`)
   - Runs unit/integration tests (`npm test`)
   - Installs Playwright browsers
   - Builds frontend (`npm run build`)
   - Runs E2E tests (`npx playwright test`)

3. **docker**: Docker build and test
   - Builds Docker image
   - Tests container health endpoints
   - Tests API endpoints
   - Verifies frontend is served

4. **security**: Security scanning
   - Runs Trivy vulnerability scanner
   - Uploads results to GitHub Security tab

5. **lint**: Code quality checks
   - Runs Python linting (`pixi run lint`)
   - Runs frontend linting (if available)
   - Runs pre-commit hooks

### `image-build-push.yml` - Docker Image Build and Push

Builds and pushes Docker images to GCP Artifact Registry.

**Triggers:**
- Push to `main` branch → tags as `latest`
- Push to `semver-tag-ranges` branch → tags as commit SHA
- Push version tag (`v*`) → tags as version
- Manual workflow dispatch

**Process:**
1. Authenticates to Google Cloud
2. Builds multi-platform Docker image (linux/amd64, linux/arm64)
3. Pushes to GCP Artifact Registry
4. Creates/updates `latest` tag on main branch

## Project Structure Changes

The workflows have been updated to reflect the new project structure:

- **Backend**: `agentic_cervical_screener/` package
- **Frontend**: `frontend/` directory with TypeScript/Vite
- **Tests**: Separate backend (Python) and frontend (Node.js) test suites
- **Build**: Frontend builds to `frontend/dist/` (gitignored)

## Notes

- Frontend E2E tests require a running backend server. In CI, Playwright's `webServer` config starts the frontend dev server, but backend must be available at `http://localhost:8000` for full E2E testing.
- Docker build includes both frontend and backend in a single image.
- All build artifacts (`frontend/dist/`, `frontend/playwright-report/`, `frontend/test-results/`) are gitignored and should not be committed.

