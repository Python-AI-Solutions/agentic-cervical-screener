# Clarifications Needed

1. **Documentation Scope vs. Spec**
   - The spec (FR-006) still states that only README.md and `docs/TESTING.md` should be updated, yet the project relies on `AGENTS.md`, the new `TODO.md`, and this clarifications file to coordinate handoff. Please confirm whether these auxiliary docs are acceptable or if FR-006 needs to be revised.

2. **Workspace Tabs in Spec**
   - The UI now exposes Cytology/Colposcopy/HPV/EHR workspaces, but the current spec only discusses the Cytology viewer. Should the spec be updated to describe the multi-view shell and placeholder expectations, or should the extra tabs be removed until formally scoped?

3. **VLM Pipeline Expectations**
   - `pixi run vlm-viewer` frequently fails on Apple Silicon (Metal GPU timeouts with pixtral-12b-4bit, schema errors on SmolVLM). The spec assumes VLM is a hard gate (FR-005/SC-003). Do we need to standardize on a smaller model, adjust the audit to allow retries, or document an approved fallback when the pipeline can’t run?

4. **Playwright Evidence Locations**
   - The spec references `frontend/e2e/viewer.spec.ts`, but the canonical suite is now `viewer-responsive.spec.ts`. Should we rename the suite back to `viewer.spec.ts` for alignment, or update the spec/plan/tasks accordingly?

5. **Screenshot Interpretation Guidance**
   - The VLM prompt now attempts to explain the new header layout, but the model still flags high-severity issues. Should additional visual annotations (e.g., overlaying helper text on screenshots) be approved, or is there appetite to adjust the acceptance criteria for the header visuals?
