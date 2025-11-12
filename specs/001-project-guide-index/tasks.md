---

description: "Task list for Project Overview Guidance Index feature"
---

# Tasks: Project Overview Guidance Index

**Input**: Design documents from `/specs/001-project-guide-index/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Dual-Layer Evidence + VLM audit are mandatory. Each user story pairs Vitest markdown parsing with Playwright renders and a lightweight MLX VLM pass over screenshots/JSON artifacts.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Constitution Hooks (apply to every tasks.md)

- Flag tasks that prove deterministic imaging or layout fidelity (Principle 1) and cite the Niivue transforms or responsive breakpoints involved.
- For each user story, include paired test tasks: Vitest/pytest (logic) + Playwright (e2e) referencing expected artifacts (screenshots + JSON).
- Add tasks that verify responsive + accessibility requirements (header behavior, tap targets, ARIA labels) when UI changes occur, including scenarios where drawers/panels cover the canvas and must provide dismissal controls.
- Include observability/telemetry updates, anchor exports, and documentation edits so Principles 4 & 5 are satisfied before calling a story complete.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish dependencies, scripts, and contributor guidance for the new documentation workflow.

- [ ] T001 Update doc-parsing dependencies in `frontend/package.json` and `package-lock.json` (add `gray-matter`, `remark-parse`, `mdast-util-find`, `yaml`, and MLX tooling references).  
- [ ] T002 Add npm aliases (`docs:test`, `docs:e2e`, `docs:vlm-review`) in `frontend/package.json` pointing to Vitest, Playwright, and MLX commands described in quickstart.  
- [ ] T003 Document Apple MLX requirements and doc-audit command sequence inside `docs/AGENT_GUIDE.md` under the development workflow section.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented.

- [ ] T004 Implement FastAPI routes in `agentic_cervical_screener/main.py` (and related router files if needed) to serve `/docs/project-overview` HTML and `/docs/project-overview/anchors` JSON consistent with `contracts/docs-overview.openapi.yaml`.  
- [ ] T005 Create `frontend/src/routes/docs/OverviewPreview.tsx` (and register it in the router entry file) to render `docs/project_overview.md` with header/drawer chrome for Playwright.  
- [ ] T006 Update `frontend/playwright.config.ts` to register the `docs-overview` project, set device profiles (desktop/tablet/large-phone/small-phone), and route screenshot/JSON outputs to `frontend/playwright-report/data/docs-overview/`.  
- [ ] T007 Scaffold `docs/__tests__/project_overview.index.test.ts` with a shared parser utility (gray-matter + remark) that loads YAML front matter, headings, lists, and tables for later assertions.  
- [ ] T008 Scaffold `frontend/e2e/docs-overview.spec.ts` to hit the preview route, toggle the mock Case Management drawer, and persist baseline screenshots/DOM dumps.  
- [ ] T009 Implement `frontend/scripts/docs-overview-vlm.ts` (TypeScript/Node) that shells out to `python -m mlx_lm.generate --model mlx-community/llava-phi-3-mini-4k` per screenshot/JSON pair and writes `frontend/playwright-report/data/docs-overview/vlm-report.md`.

**Checkpoint**: Backend preview endpoints, frontend route, Playwright/Vitest harnesses, and MLX script exist—user stories can now begin.

---

## Phase 3: User Story 1 - Guided Onboarding Path (Priority: P1) 🎯 MVP

**Goal**: Provide a three-step Orientation Path (README → AGENT_GUIDE → TESTING) with canonical commands so new contributors can get productive immediately.

**Independent Test**:  
- Vitest: `docs/__tests__/project_overview.index.test.ts` rejects Orientation Path counts ≠3 or missing command snippets.  
- Playwright: `frontend/e2e/docs-overview.spec.ts` verifies the Orientation section stays above the fold at all breakpoints and records JSON metadata for the callouts.  
- VLM: `frontend/scripts/docs-overview-vlm.ts` flags readability/occlusion issues in `vlm-report.md`.

### Tests for User Story 1

- [ ] T010 [P] [US1] Extend `docs/__tests__/project_overview.index.test.ts` to assert Orientation Path step count ≤3, required command snippets, and valid relative links.  
- [ ] T011 [P] [US1] Add Orientation Path viewport assertions inside `frontend/e2e/docs-overview.spec.ts` (desktop/tablet/phone), exporting JSON metadata to `frontend/playwright-report/data/docs-overview/orientation.json`.

### Implementation for User Story 1

- [ ] T012 [US1] Rewrite the Orientation Path section in `docs/project_overview.md` with exactly three numbered steps, embedded command blocks, and rationale text per FR-002.  
- [ ] T013 [US1] Add Orientation Path backlinks in `README.md` (Quick Start) pointing to `docs/project_overview.md#orientation-path`.  
- [ ] T014 [US1] Update `docs/AGENT_GUIDE.md` onboarding section to reference the new Orientation Path anchors and describe why each command matters.  
- [ ] T015 [US1] Update `docs/TESTING.md` introduction to reference the Orientation Path for locating CLI usage and responsive evidence.  
- [ ] T016 [US1] Wire the VLM script call for Orientation screenshots (`frontend/scripts/docs-overview-vlm.ts`) so it tags any occlusion issues found in `vlm-report.md` with `[US1]`.

**Checkpoint**: Orientation Path authored, linked, and validated by Vitest + Playwright + VLM; new contributors can run the core commands without assistance.

---

## Phase 4: User Story 2 - Topic-to-Doc Index (Priority: P2)

**Goal**: Maintain a comprehensive Topic-to-Doc index and workflow playbooks so planners instantly locate the canonical references.

**Independent Test**:  
- Vitest ensures the table has ≥8 rows with mandatory columns and that workflow playbooks list required document sequences.  
- Playwright scrolls through the table at each breakpoint, validating visibility and capturing link JSON.  
- VLM evaluates readability (contrast, density) of the table/playbook sections.

### Tests for User Story 2

- [ ] T017 [P] [US2] Extend `docs/__tests__/project_overview.index.test.ts` to assert the Topic-to-Doc table columns, minimum row count, and workflow playbook presence.  
- [ ] T018 [P] [US2] Enhance `frontend/e2e/docs-overview.spec.ts` to scroll the index table, record anchor/link JSON, and ensure the Case Management drawer dismiss control remains visible on mobile.

### Implementation for User Story 2

- [ ] T019 [US2] Author the Topic-to-Doc index table (≥8 topics) inside `docs/project_overview.md`, including `Use When`, `Primary Doc`, and `Secondary/Artifacts` columns with relative links.  
- [ ] T020 [US2] Add “Workflow Playbooks” in `docs/project_overview.md` (new contributor, spec author, release triage) detailing ordered documents plus responsive/observability checkpoints.  
- [ ] T021 [US2] Ensure the Playwright JSON exporter in `frontend/e2e/docs-overview.spec.ts` writes `reference-index.json` and includes breadcrumbs for any drawer state used while capturing the table.

**Checkpoint**: Maintainers can locate any topic/doc within 30 seconds using the validated table and playbooks.

---

## Phase 5: User Story 3 - Automation Anchors & Maintenance Guardrails (Priority: P3)

**Goal**: Provide machine-readable metadata, anchor inventories, and maintenance workflow guidance so automation agents keep the overview synchronized.

**Independent Test**:  
- Vitest parses YAML front matter + anchor list, rejecting missing keys or stale dates.  
- Playwright confirms the metadata callout renders properly across breakpoints and that dismissal controls remain accessible when drawers cover content.  
- VLM highlights any readability or safe-area regressions in metadata/maintenance sections.

### Tests for User Story 3

- [ ] T022 [P] [US3] Extend `docs/__tests__/project_overview.index.test.ts` to validate YAML keys (`audience`, `owners`, `doc_version`, `last_reviewed`, `update_triggers`, `anchor_slugs`) and the Reference Anchors section alignment.  
- [ ] T023 [P] [US3] Update `frontend/e2e/docs-overview.spec.ts` to capture metadata callout screenshots, confirm safe-area padding for full-height drawers, and persist anchor inventories to `frontend/playwright-report/data/docs-overview/anchors.json`.

### Implementation for User Story 3

- [ ] T024 [US3] Insert YAML front matter, Maintenance & Update Workflow, and Reference Anchors sections into `docs/project_overview.md`, ensuring anchor slugs align with headings and `last_reviewed`/`doc_version` values update.  
- [ ] T025 [US3] Update `frontend/scripts/docs-overview-vlm.ts` to merge Vitest/Playwright outputs, annotate findings by severity, and fail with exit code ≠0 when VLM detects medium+ accessibility issues in metadata/maintenance sections.

**Checkpoint**: Automation agents consume machine-readable metadata + anchors; maintenance workflow is documented and enforced via tests + VLM analysis.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Ensure documentation, automation artifacts, and supporting guides remain in sync after story work.

- [ ] T026 Regenerate quickstart instructions in `specs/001-project-guide-index/quickstart.md` and `docs/AGENT_GUIDE.md` to reflect the finalized Vitest/Playwright/VLM command trio.  
- [ ] T027 Verify `contracts/docs-overview.openapi.yaml` matches the implemented FastAPI routes and update any schema drift.  
- [ ] T028 Update `docs/project_overview.md` metadata (`last_reviewed`, `doc_version`) and attach the latest `frontend/playwright-report/data/docs-overview/vlm-report.md` summary to the PR checklist.

---

## Dependencies & Execution Order

- **Phase Dependencies**  
  - Setup (Phase 1) → Foundational (Phase 2) → User Stories (Phase 3-5) → Polish.  
  - User stories execute in priority order (US1 → US2 → US3). Each story is independently testable once Foundational tasks complete.

- **User Story Dependency Graph**  
  - `US1 (Orientation)` → enables `US2 (Topic Index)` → enables `US3 (Automation Anchors)` for governance completeness.  
  - Graph: `US1 ─▶ US2 ─▶ US3`.

- **Parallel Opportunities**  
  - [Setup] T001 and T002 can run in parallel after cloning; T003 depends on T002.  
  - [US1] Tests (T010/T011) can proceed in parallel once Vitest/Playwright scaffolds exist, while doc edits (T012-T015) proceed concurrently with VLM tagging (T016).  
  - [US2] Table authoring (T019) and workflow playbooks (T020) can happen alongside Playwright enhancements (T018) because they touch different files.  
  - [US3] Metadata authoring (T024) can proceed while VLM enforcement (T025) is coded, as long as Vitest assertions (T022) are in place.

- **Implementation Strategy**  
  1. **MVP (US1)**: Deliver Orientation Path + dual-layer + VLM checks so new contributors have an authoritative start.  
  2. **Increment 2 (US2)**: Add Topic-to-Doc index and workflow playbooks for planners/reviewers.  
  3. **Increment 3 (US3)**: Finalize automation metadata, anchors, and maintenance workflows, locking governance expectations.  
  4. **Polish**: Refresh quickstart/AGENT docs and ensure contracts + metadata reflect the shipped experience.

---

## Parallel Example: User Story 1

```bash
# Terminal 1: Implement Vitest assertions
npm test -- --runTestsByPath docs/__tests__/project_overview.index.test.ts

# Terminal 2: Update markdown + cross-link docs
code docs/project_overview.md README.md docs/AGENT_GUIDE.md docs/TESTING.md

# Terminal 3: Capture Playwright + VLM artifacts
cd frontend && npm run test:e2e -- docs-overview.spec.ts && npm run docs:vlm-review
```
