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
   - Cross-link `README.md`, `AGENTS.md`, and `docs/TESTING.md` to the overview as required by the spec.

3. **Run markdown validation tests**
   ```bash
   npm test -- docs/__tests__/project_overview.index.test.ts
   ```
   - Fails if required sections, tables, or anchors are missing.

4. **Execute Playwright doc journey**
   ```bash
   cd frontend
   npm run docs:e2e -- docs-overview.spec.ts
   ```
   - Captures desktop/tablet/large-phone/small-phone screenshots and emits `frontend/playwright-artifacts/docs-overview/anchors.json`.

5. **Run Viewer audit (captures actual UI)**
   ```bash
   cd frontend
   npm run docs:e2e -- viewer-responsive.spec.ts
   ```
   - Stores screenshots + layout JSON under `frontend/playwright-artifacts/viewer/`. The next step feeds them through the local VLM audit to catch header/action regressions.

6. **Run VLM UX audit for docs/viewer (Apple Silicon, ≥16 GB RAM recommended)**
   ```bash
   cd frontend
   pixi run npm run vlm:docs
   pixi run npm run vlm:viewer
   ```
   - Scripts load screenshots + JSON artifacts, call the `llm` CLI (backed by Ollama + LLava), and output `vlm-report.md` summarizing occlusion/accessibility findings. Ensure `ollama serve` is running and that you have pulled a multimodal model such as `ollama pull llava`. Override the default by exporting `VLM_MODEL`. Run `pixi run npm run test:vlm` to execute both commands sequentially. Fail the build if severity ≥ medium.

7. **Run onboarding + freshness metrics**
   ```bash
   npm run docs:metrics
   ```
   - Executes `scripts/docs/onboarding-metrics.ts` (ensures ≥90% success across the latest 10 entries in `docs/metrics/onboarding-log.csv`) and `scripts/docs/check-doc-freshness.ts` (fails if YAML `last_reviewed` is >30 days old).

8. **Serve documentation preview (optional sanity check)**
   ```bash
   pixi run dev
   ```
   - Visit `http://localhost:8000/docs/project-overview` to confirm the rendered page shows metadata callout, Orientation Path, topic index, and safe dismiss controls for drawers.

9. **Update maintenance metadata**
   - Bump `doc_version` and `last_reviewed` in the YAML front matter whenever content changes.
   - Ensure the Orientation Path steps still reference valid commands.

10. **Prepare PR / review evidence**
   - Attach the latest Playwright screenshots + anchors JSON.
   - Include `frontend/playwright-artifacts/docs-overview/vlm-report.md`, `frontend/playwright-artifacts/viewer/vlm-report.md`, onboarding metrics output, and freshness check output.
   - Note Vitest + Playwright + VLM + metrics run hashes (docs + viewer suites) in the PR description.
