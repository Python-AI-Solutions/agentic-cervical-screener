# Quickstart – Project Overview Guidance Index

## Prerequisites

- Node.js 18+, npm installed (frontend toolchain)
- Pixi environment for Python backend (needed only to serve docs via FastAPI)
- Playwright browsers installed (`npx playwright install --with-deps`)

## Local Workflow

1. **Checkout feature branch**
   ```bash
   git checkout 001-project-guide-index
   ```

2. **Update documentation content**
   - Edit `docs/project_overview.md` to add YAML metadata, Orientation Path, Topic-to-Doc index, workflow playbooks, and maintenance anchors.
   - Cross-link `README.md`, `docs/AGENT_GUIDE.md`, and `docs/TESTING.md` to the overview as required by the spec.

3. **Run markdown validation tests**
   ```bash
   npm test -- docs/__tests__/project_overview.index.test.ts
   ```
   - Fails if required sections, tables, or anchors are missing.

4. **Execute Playwright doc journey**
   ```bash
   cd frontend
   npm run test:e2e -- docs-overview.spec.ts
   ```
   - Captures desktop/tablet/large-phone/small-phone screenshots and emits `frontend/playwright-report/data/docs-overview/anchors.json`.

5. **Run VLM UX audit (Apple Silicon, ≤16 GB RAM)**
   ```bash
   cd frontend
   npm run docs:vlm-review \
     -- --model mlx-community/llava-phi-3-mini-4k \
     --screenshots ./playwright-report/data/docs-overview
   ```
   - Script loads screenshots + JSON artifacts, calls the MLX runtime (`python -m mlx_lm.generate ...` under the hood), and outputs `vlm-report.md` summarizing occlusion/accessibility findings. Fail the build if severity ≥ medium.

6. **Serve documentation preview (optional sanity check)**
   ```bash
   pixi run dev
   ```
   - Visit `http://localhost:8000/docs/project-overview` to confirm the rendered page shows metadata callout, Orientation Path, topic index, and safe dismiss controls for drawers.

7. **Update maintenance metadata**
   - Bump `doc_version` and `last_reviewed` in the YAML front matter whenever content changes.
   - Ensure the Orientation Path steps still reference valid commands.

8. **Prepare PR / review evidence**
   - Attach the latest Playwright screenshots + anchors JSON.
   - Include `docs/playwright-report/data/docs-overview/vlm-report.md` excerpt or failing notes.
   - Note Vitest + Playwright + VLM run hashes in the PR description.
