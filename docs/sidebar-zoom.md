# Sidebar, Browser Zoom, and Canvas Sizing (Static Viewer)

This repo now ships a single static viewer under `public/` (no legacy `frontend/` tree). This note explains how:
- the sidebar layout,
- browser zoom (CSS pixels + `devicePixelRatio`),
- and canvas sizing / ROI alignment

interact, and proposes a strategy that avoids “zoom makes the sidebar permanently disappear” class of bugs while keeping ROIs/overlays aligned.

## Two different “zooms” to keep separate

1) **Browser zoom** (Ctrl/Cmd +/-):
- Changes the *CSS pixel* viewport size and often changes `window.devicePixelRatio`.
- Can trip CSS media queries because media queries use CSS pixels.

2) **Viewer zoom/pan** (wheel/pinch inside the image):
- Implemented in JS (`currentZoomLevel`, `panX/panY`) and should not be conflated with browser zoom.

When debugging, always ask: “did the user zoom the page, or zoom the image?”

## Current layout behavior (static viewer)

Defined in `public/index.html`:
- Desktop layout: `.view-container` uses a 2‑column grid (`sidebar + content`).
- Sidebar collapse is an explicit UI state (`.view-container.sidebar-collapsed` sets the sidebar column to `0`).
- Mobile sidebar is an overlay layout under `@media (max-width: 560px)` (sidebar becomes `position: fixed` and slides in/out).
- Sidebar state is toggled via `applySidebarState()` / `toggleSidebar()` in the inline script.

## Why browser zoom can still cause “it got stuck hidden”

You can’t stop browser zoom from changing CSS pixels. The trick is to make “mobile vs desktop layout” a *presentation concern* that does **not** accidentally mutate *persistent UI state*.

The classic failure mode (described by the older version of this doc) is:
- A width breakpoint triggers at higher zoom.
- JS treats that breakpoint crossing as “user intent” and force-closes / resets panels.
- When the user zooms back out, the app remembers the closed state and the sidebar feels “permanently collapsed”.

The current code is already better than the historical version (no aggressive “auto-close at X px”), but the same class of bug can still happen if:
- CSS and JS disagree about what “mobile” means (breakpoint drift), or
- a single `sidebarVisible` flag is shared across mobile overlay mode and desktop docked mode.

## Canvas sizing + ROI alignment constraints

Rendering needs to be deterministic across:
- layout changes (sidebar open/close, view switch),
- browser zoom (`devicePixelRatio` changes),
- and viewer zoom/pan (transform changes).

The safest invariant is:
- **Store annotations (ROIs, detections, ground truth) in image pixel coordinates.**
- **Maintain exactly one image→screen transform** (`scale`, `tx`, `ty`) in CSS pixel units.
- **Update canvas buffers when either the container size or DPR changes**, and then re-render.

## Strategy (recommended)

### 1) Make “layout mode” single-source-of-truth
Pick one authority for mobile/desktop mode and stick to it:
- **Best**: a CSS “sentinel” custom property set inside media queries (JS reads it via `getComputedStyle`), so breakpoint changes only happen in CSS.
- **Acceptable**: a shared `matchMedia()` query string used everywhere (but beware drift).

Avoid having multiple “mobile” thresholds across files (e.g., 560 vs 768 vs 1024) driving logic that mutates state.

### 2) Split sidebar state by mode (prevents zoom-induced “sticky hidden”)
Track two independent states:
- `desktopSidebarVisible` (default `true`)
- `mobileSidebarVisible` (default `false`)

On mode change:
- entering mobile overlay mode → apply `mobileSidebarVisible`
- entering desktop docked mode → apply `desktopSidebarVisible`

This ensures that a temporary zoom (or narrow window) doesn’t permanently alter the desktop sidebar preference.

### 3) Don’t auto-close on resize/breakpoint crossings
Resize/breakpoint crossings should *re-layout* and *re-measure*, not reset user intent.
If something must change on mode transitions, constrain it to “presentation-only” classes (positioning/translation), not the visibility preference itself.

### 4) Centralize canvas resize + render pipeline
Have one place that responds to “viewport changed” events:
- `ResizeObserver` on `#viewer` (catches sidebar open/close and CSS breakpoints)
- `window.resize` / `visualViewport.resize` (catches zoom/orientation/keyboard)
- a DPR watcher for cross-monitor and some zoom cases

That function should:
1) read container CSS size
2) read DPR
3) update canvas pixel buffers + CSS size
4) recompute the image→screen transform (fit + viewer zoom/pan)
5) render image + overlays

This reduces the chance that one codepath updates canvas size while another codepath updates transforms.

## Safe rollout plan

1) Update breakpoint usage so CSS + JS agree on “mobile sidebar overlay” mode.
2) Implement split sidebar state (`desktopSidebarVisible` / `mobileSidebarVisible`) and verify with:
   - narrow viewport (<560px) open/close,
   - desktop open/close,
   - switch between the two via resizing and via browser zoom.
3) Verify canvas alignment with the manual smoke test in `docs/TESTING.md` (67%, 100%, 175% browser zoom) and by toggling the sidebar while zoomed.
4) Only then consider deeper refactors (e.g., removing unused “Option A” drawing paths) once behavior is stable.
