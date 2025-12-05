# TODO

## Viewer & UI
- [ ] Validate the new workspace dropdown/placeholder panels on real devices and update Playwright coverage so non-cytology views are at least smoke-tested.
- [ ] Align header styling with VLM expectations (ensure icons/text never clip) or adjust prompt/tests based on final approved layout.
- [ ] Add accessible labels/helptext for the workspace selector and action buttons (ARIA + keyboard focus states).

## VLM Pipeline
- [ ] Stabilize `pixi run vlm-viewer` on Apple Silicon (investigate GPU timeouts with pixtral-12b-4bit, consider smaller defaults or batching).
- [ ] Extend pytest coverage for `scripts/vlm_viewer_audit.py` to cover the new context injection paths and GPU failure modes.
- [ ] Re-run `pixi run vlm-viewer` once the pipeline is stable and update `frontend/playwright-artifacts/viewer/vlm-report.md` for handoff evidence.

## Documentation & Specs
- [ ] Update `specs/001-project-guide-index/spec.md` to mention the new multi-workspace shell and clarify which docs may change (README, docs/TESTING.md, AGENTS.md, TODO.md, clarifications).
- [ ] Capture current screenshot/VLM workflow in `docs/TESTING.md` so it mirrors AGENTS.md guidance.

## Testing
- [ ] Consider adding Playwright coverage for the workspace dropdown (ensuring non-cytology panels hide the viewer and show placeholders).
- [ ] Investigate flaky `viewer-responsive.spec.ts` logs about "Unable to derive bounding boxes" and tighten the assertions.
