# Data Model – Project Overview Guidance Index

## Entity: OrientationStep

| Field | Type | Constraints / Validation | Notes |
| --- | --- | --- | --- |
| `order` | Integer | 1–3, sequential with no gaps | Defines the exact order users follow |
| `title` | String | Required, ≤60 chars | Short action label (e.g., “Read README.md overview”) |
| `description` | Markdown paragraph | Required | Explains what the contributor learns |
| `primary_link` | Relative URL | Required, must match existing repo doc | e.g., `README.md`, `AGENTS.md` |
| `commands` | String[] | Optional, but if present command text must match actual CLI snippet | Used to list `pixi run dev`, `npm test`, etc. |

**Relationships / Rules**:
- Steps reference canonical docs; Vitest will assert the link path exists.
- Only three steps allowed to keep onboarding fast.

## Entity: TopicDocIndexRow

| Field | Type | Constraints / Validation | Notes |
| --- | --- | --- | --- |
| `topic` | String | Required, unique | e.g., “Responsive UX”, “Datasets” |
| `use_when` | String | Required sentence | Describes scenario for referencing the doc |
| `primary_doc` | Relative URL | Required, must resolve to markdown or code path | Main source of truth |
| `secondary_artifacts` | String[] | Optional; file paths or artifact names | Additional references (Playwright report, README sections) |
| `last_reviewed` | ISO date | Optional; defaults to metadata block `last_reviewed` | Enables per-topic freshness if needed |

**Rules**:
- Table must contain ≥8 rows covering architecture, datasets, responsive UX, testing, automation, deployment, data governance, troubleshooting.
- Links must stay relative to repo root to keep GitHub previews working.

## Entity: MaintenanceMetadata

| Field | Type | Constraints / Validation | Notes |
| --- | --- | --- | --- |
| `audience` | String[] | Required; enumerates “New contributors”, “AI agents”, etc. | Used by automation for routing |
| `owners` | String[] | Required GitHub handles/emails | Responsible for keeping doc fresh |
| `doc_version` | String (semver) | Required | Increments whenever structure changes |
| `last_reviewed` | ISO date | Required; equals commit date when doc updated | Feeds freshness checks |
| `update_triggers` | String[] | Required; describes events that force review | e.g., “commands change”, “new doc added” |
| `anchor_slugs` | String[] | Required; must include slug for every major section heading | Helps downstream linking |

**Rules**:
- Stored as YAML front matter parsed by `gray-matter`.
- Vitest ensures keys exist and values meet formatting requirements.

## Entity: AnchorExport

| Field | Type | Constraints / Validation | Notes |
| --- | --- | --- | --- |
| `slug` | String | Required, matches section heading id | e.g., `orientation-path` |
| `heading` | String | Required | Display text |
| `breadcrumbs` | String | Optional; e.g., “Case Management Drawer → DEMO-004” | Provided when panels cover imagery |
| `dismiss_controls` | String[] | Optional; names of buttons/gestures to close overlays | Ensures Constitution compliance |

**Rules**:
- Generated during Playwright run and written to `frontend/playwright-report/data/docs-overview/anchors.json`.
- Serves as downstream machine-readable index for automation agents.
