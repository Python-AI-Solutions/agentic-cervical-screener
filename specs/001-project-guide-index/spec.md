# Feature Specification: Project Overview Guidance Index

**Feature Branch**: `001-project-guide-index`  
**Created**: 2025-11-12  
**Status**: Draft  
**Input**: User description: "docs/project_overview.md should provide guidance and index to other useful descriptions."

## User Scenarios & Testing *(mandatory)*

> **Constitution Hooks**  
> - Each user story MUST trace to (a) a deterministic-fidelity acceptance check (math/unit tests or documented transforms) and (b) a Playwright journey that captures screenshots + JSON metrics.  
> - Responsive + accessibility expectations from `docs/project_overview.md §5` must be listed explicitly in the Acceptance Scenarios for any UI change.  
> - Note which observability/logging signals or documentation pages will be updated to satisfy Principles 4 and 5.

### User Story 1 - Guided Onboarding Path (Priority: P1)

A newly assigned human or AI contributor must be able to open `docs/project_overview.md`, understand the product context, and follow a three-step orientation path that points to README, `AGENTS.md`, and `docs/TESTING.md` plus the minimum commands to run (`pixi run dev`, `npm run dev`, `npm test`, `npm run test:e2e:ci`).

**Why this priority**: Without an authoritative front door, onboarding stalls and downstream specs/plans drift from the actual workflow, violating Principle 5 (documentation stewardship).

**Independent Test**:  
- Deterministic check: add a markdown-parsing Vitest script (`docs/__tests__/project_overview.index.test.ts`) that fails if the Orientation Path section or mandatory command snippets are missing.  
- Playwright evidence: extend the documentation showcase journey to render the markdown inside the existing Vite sandbox page, capture desktop/tablet/phone screenshots, and verify the Orientation Path callouts remain above the fold and never overlap header elements.  
- VLM audit: run the MLX-hosted `llava-phi-3-mini-4k` review script on the Orientation screenshots + JSON metadata; PRs must include the generated `vlm-report.md` with no medium-or-higher issues.

**Acceptance Scenarios**:

1. **Given** a first-time contributor reading the Orientation Path, **When** they follow the ordered steps, **Then** they can run the listed commands and know which deeper guides to open next without asking for help.  
2. **Given** the markdown validation test runs in CI, **When** `docs/project_overview.md` omits any required link or command, **Then** the Vitest suite fails before merge and cites the missing anchor.

---

### User Story 2 - Topic-to-Doc Index (Priority: P2)

A maintainer planning work or writing specs must see a labeled index that maps each core topic (architecture, datasets, responsive UX, testing, deployment, automation, data governance) to the canonical document, its purpose, last-reviewed date, and secondary references.

**Why this priority**: Planning and review workflows depend on citing authoritative sources; lacking an index causes duplicate guidance and erodes Principle 2’s evidence trail.

**Independent Test**:  
- Deterministic check: the markdown parser asserts the Reference Index table contains at least eight rows and the required columns (`Topic`, `Use When`, `Primary Doc`, `Secondary/Artifacts`).  
- Playwright evidence: the doc showcase journey scrolls through the Reference Index, verifying each link is visible at the expected breakpoints and capturing JSON metadata of the extracted href targets.  
- VLM audit: the same MLX script inspects the table/playbook screenshots to ensure readability, proper breadcrumbs, and visible dismiss controls.

**Acceptance Scenarios**:

1. **Given** a maintainer evaluating a feature, **When** they scan the Reference Index table, **Then** they find the correct document links for their topic (e.g., responsive UX → `docs/project_overview.md §5` + `frontend/docs/ZOOM_ISSUES_AND_FIXES.md`).  
2. **Given** the automated checks run, **When** any indexed document is removed or renamed, **Then** the tests fail with the missing path so the index is updated before merging.

---

### User Story 3 - Automation Anchors & Maintenance Guardrails (Priority: P3)

Automation agents (Specify, CI checkers) need machine-readable anchors and maintenance guidance so they can keep the overview synchronized with new docs without manual spelunking.

**Why this priority**: Without explicit anchors and owners, the overview drifts, Playwright artifacts lose traceability, and governance reviews cannot prove compliance with Principles 4 and 5.

**Independent Test**:  
- Deterministic check: the markdown test extracts a front-matter metadata block (audience, owners, last-reviewed, doc-version, related specs) and fails if any required key or anchor slug is missing.  
- Playwright evidence: the doc showcase run validates that the metadata callout appears consistently at the top of the rendered page across breakpoints, ensuring accessibility (≥44 px tap targets, WCAG-compliant contrast).  
- VLM audit: the MLX review script inspects metadata + maintenance sections, scoring safe-area padding and readability; merges require zero medium/high regressions.

**Acceptance Scenarios**:

1. **Given** automation parsing the file header, **When** it reads the metadata block, **Then** it retrieves audience, owners, last-reviewed date, and anchor slug names without additional heuristics.  
2. **Given** a maintainer reviewing documentation debt, **When** they consult the “Maintenance & Update Workflow” section, **Then** they see concrete triggers (new doc added, command change, responsive rules updated) and instructions for updating both the markdown and associated tests/Playwright artifacts.

---

### Edge Cases

- Documentation stays useful when zoomed or viewed on phones: callouts, tables, and link lists must stack cleanly so Playwright screenshots show no overlap with headers or safe-area insets.  
- New documents or directories may be added later; the Reference Index must explain how to add future rows so the script + Playwright test can validate them without code changes.  
- If any referenced doc temporarily moves (e.g., branch rename), the overview must explain fallback behavior (point to migration note or README) so tests can degrade gracefully without blocking releases.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `docs/project_overview.md` MUST start with a metadata panel (audience, owners, last-reviewed date, version, updated-on-change triggers) formatted as fenced YAML so automation can parse it.  
- **FR-002**: The Orientation Path section MUST outline ≤3 sequential steps, each linking to README, `AGENTS.md`, and `docs/TESTING.md`, and MUST embed the canonical commands (`pixi run dev`, `npm run dev`, `npm test`, `npm run test:e2e:ci`) with short rationales.  
- **FR-003**: Provide a “Topic-to-Doc Index” table containing at least eight topics covering architecture, datasets, responsive UX, testing, automation artifacts, deployment, data governance, and troubleshooting; each row MUST include `Topic`, `Use When`, `Primary Doc`, and `Secondary/Artifacts` columns with relative links.  
- **FR-004**: Add a “Workflow Playbooks” section describing at least three common workflows (new contributor, spec author, release triage) and the ordered document sequence each should follow, explicitly referencing responsive and observability expectations.  
- **FR-005**: Introduce a “Maintenance & Update Workflow” subsection that declares update triggers, responsible roles, and how to run the markdown + Playwright checks before merging doc edits.  
- **FR-006**: Embed a machine-readable anchor list (e.g., `## Reference Anchors`) that enumerates slug names other docs/specs can reference; each anchor MUST align with the headings used in the body.  
- **FR-007**: Create or extend a unit-level markdown validation test (Vitest or pytest) that parses the overview to confirm the metadata block, Orientation Path, table column headers, and minimum link count are present; the test MUST run via `npm test`.  
- **FR-008**: Add a Playwright journey (`frontend/e2e/docs-overview.spec.ts`) that loads the rendered markdown via the existing documentation preview page, captures desktop/tablet/phone screenshots, stores JSON metadata of extracted anchor links, and asserts safe-area padding prevents overlap with the header per Principle 3.  
- **FR-009**: Update `AGENTS.md` and `README.md` references (if necessary) so they link back to the overview, keeping the cross-reference graph strongly connected.  
- **FR-010**: Provide served documentation endpoints: `/docs/project-overview` delivers rendered HTML, and `/docs/project-overview/anchors` returns anchor + orientation metadata JSON as defined in `contracts/docs-overview.openapi.yaml`.  
- **FR-011**: Ship a lightweight, offline-capable VLM audit pipeline (MLX runtime + `mlx-community/llava-phi-3-mini-4k`) that consumes Playwright screenshots/JSON and emits `vlm-report.md`, failing CI on medium-or-higher UX findings.  
- **FR-012**: Instrument onboarding and freshness metrics by adding `docs/metrics/onboarding-log.csv` plus scripts (`scripts/docs/onboarding-metrics.ts`, `scripts/docs/check-doc-freshness.ts`) that (a) ensure ≥90% success across the latest 10 onboarding entries and (b) fail builds when the YAML `last_reviewed` date is older than 30 days.

### Key Entities *(include if feature involves data)*

- **Guided Orientation Path**: Structured, numbered list that routes new contributors through README → AGENT_GUIDE → TESTING while highlighting required commands and responsive evidence expectations.  
- **Documentation Index Table**: Canonical matrix of topics to documents, including metadata (use cases, secondary artifacts) consumed by humans and markdown-parsing scripts.  
- **Maintenance Metadata Block**: YAML front matter exposing doc owners, audience, last-reviewed date, and anchor slugs so automation can detect staleness.  

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Reviewers can locate the correct downstream document for a given topic within 30 seconds using the Topic-to-Doc Index (validated through doc review checklist sign-off).  
- **SC-002**: The onboarding metrics script confirms that ≥90% of the last 10 rows in `docs/metrics/onboarding-log.csv` report successful command execution.  
- **SC-003**: The freshness check script fails when the YAML `last_reviewed` value is more than 30 days old, ensuring the document stays within one release of reality.  
- **SC-004**: Automated documentation previews capture cross-device screenshots and link inventories with zero accessibility violations reported in CI, and the VLM audit emits a clean `vlm-report.md`.  
- **SC-005**: Fast documentation checks fail whenever required sections or links are missing, preventing incomplete updates from merging.

## Assumptions

- Contributors continue to rely on GitHub-rendered markdown; no external docs site is required for this update.  
- A lightweight documentation preview page plus FastAPI proxy endpoints will be introduced so both Playwright and automation agents can render/fetch the overview without hitting external services.  
- Owners listed in the metadata block agree to refresh the document whenever referenced assets (commands, doc paths, responsive guidance) change.
- Apple Silicon (M-series) laptops with 16 GB unified memory are available for running the MLX VLM pipeline locally; CI jobs can leverage the same model via GitHub-hosted runners with MLX support.

## Dependencies & Risks

- Updates to `AGENTS.md`, `docs/TESTING.md`, or `README.md` may need to happen in parallel so cross-links remain accurate.  
- If the documentation preview route is not yet available, a small wrapper page must be created; otherwise Playwright evidence cannot be collected.  
- Failing to keep the metadata block in sync with actual owners/versions undermines the automation hooks and could delay governance reviews.
