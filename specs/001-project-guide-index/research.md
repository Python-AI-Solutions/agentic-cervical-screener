# Phase 0 Research – Project Overview Guidance Index

## Decision 1: YAML Front Matter + Anchor Inventory
- **Decision**: Prepend `docs/project_overview.md` with YAML front matter containing `audience`, `owners`, `doc_version`, `last_reviewed`, and `update_triggers`, then parse it via `gray-matter` inside a new Vitest suite to enforce presence and freshness.
- **Rationale**: YAML front matter is already a common markdown convention, works with GitHub rendering, and can be parsed without executing code. `gray-matter` integrates cleanly with TypeScript tests and lets us assert required keys plus ISO date formats.
- **Alternatives Considered**:
  1. **Inline metadata table** – human-friendly but hard to parse reliably (table reordering breaks scripts).
  2. **Separate JSON sidecar** – machine-friendly but risks drifting from the markdown source and adds another file to update.

## Decision 2: Markdown Validation via remark + Vitest
- **Decision**: Build `docs/__tests__/project_overview.index.test.ts` that loads the markdown, parses it with `remark`/`mdast-util-find`, and asserts: Orientation Path heading exists, ordered list length ≤3, Topic-to-Doc table has ≥8 rows with required columns, anchors match headings, and required command snippets are present.
- **Rationale**: remark provides a stable AST for headings, lists, and tables, enabling deterministic assertions without ad-hoc regexes. Running inside Vitest keeps the workflow aligned with existing frontend tests and maintains the “fast evidence” layer required by the constitution.
- **Alternatives Considered**:
  1. **Regex-only validation** – brittle and error-prone for table parsing.
  2. **Custom markdown parser** – unnecessary maintenance overhead compared to using remark’s mature ecosystem.

## Decision 3: Documentation Preview Route + Playwright Journey
- **Decision**: Add `frontend/src/routes/docs/OverviewPreview.tsx` that fetches the markdown at build time (via Vite `?raw` import) and renders it using the same typography tokens as the viewer header. Playwright spec `frontend/e2e/docs-overview.spec.ts` will: load this route, toggle a mock “Case Management” drawer overlay, capture screenshots at desktop/tablet/large-phone/small-phone widths, and dump link metadata plus anchor text to JSON under `frontend/playwright-report/data/docs-overview/`.
- **Rationale**: Rendering within the app guarantees the documentation is styled consistently with production headers and ensures responsive padding (safe areas, drawers) match real behavior. Playwright already runs for viewer journeys, so extending the suite minimizes new tooling.
- **Alternatives Considered**:
  1. **Testing GitHub-rendered markdown** – brittle (external dependency, rate limits, DOM structure outside our control).
  2. **Manual screenshot capture** – fails Constitution Principle 2 (no automated evidence).

## Decision 4: Anchor & Orientation Data Export
- **Decision**: During the Playwright run, evaluate the DOM to collect all anchor IDs plus their linked sections and write them to `anchors.json` alongside a summary of Orientation Path steps. Vitest ensures the JSON structure stays in sync.
- **Rationale**: Agents (Specify, future doc bots) can ingest the JSON to keep context up to date without re-parsing markdown, and the file doubles as evidence that the headless drawer/occlusion state retains breadcrumbs.
- **Alternatives Considered**:
  1. **Skip JSON export** – loses machine-readable breadcrumbs and makes future automation harder.
  2. **Generate JSON during build** – harder to validate and would require bundler changes; Playwright already has the rendered DOM.

## Decision 5: VLM Selection for UX Audits
- **Decision**: Use `mlx-community/llava-phi-3-mini-4k` (≈4 B params) running via Apple’s MLX runtime to evaluate Playwright screenshots + JSON artifacts. The evaluation script (`frontend/scripts/docs-overview-vlm.ts`) invokes `python -m mlx_lm.generate --model mlx-community/llava-phi-3-mini-4k` with each screenshot and structured prompts to flag occlusion, readability, and accessibility violations. The model outputs Markdown summaries plus severity scores, stored alongside the Playwright reports.
- **Rationale**: The MLX build is optimized for Apple Silicon and comfortably fits within 16 GB unified memory even when batch-processing four device screenshots. LLaVA-Phi-3-mini has been benchmarked on doc/question answering tasks and offers a good balance between reasoning ability and local footprint, avoiding cloud dependencies.
- **Alternatives Considered**:
  1. **llava-v1.6-mistral-7b** – More capable but risks swapping on 16 GB machines and slows CI.
  2. **Remote GPT-4o mini** – Strong reasoning but violates the requirement for offline/local evaluation and introduces latency/cost.
