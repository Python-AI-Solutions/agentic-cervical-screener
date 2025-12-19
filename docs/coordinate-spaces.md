# Coordinate Spaces, Zoom, and Canvas Rendering

This note captures the core concepts and practices that help avoid “zoom/resize makes overlays drift” and “canvas sizing is wrong on mobile/Safari” classes of bugs in canvas-based viewers.

## Two “zooms” that must not be conflated

1) **Browser zoom** (Cmd/Ctrl `+/-`)
- Changes how many device pixels back each CSS pixel and can change `window.devicePixelRatio`.
- Does **not** change the coordinate system used by DOM events and DOM layout APIs (they are in CSS pixels).

2) **Viewer zoom/pan** (wheel/pinch inside the viewer)
- A logical transform that *you* apply (e.g. zoom level + pan offsets).
- Must be expressed in your chosen coordinate space (recommended: CSS pixels for screen-space transforms and image pixels for stored annotations).

## Coordinate spaces (define them explicitly)

### 1) Viewport/event coordinates (CSS pixels)
- Pointer events (`MouseEvent.clientX/clientY`, `Touch.clientX/clientY`) are in **CSS pixels**.
- `getBoundingClientRect()` returns values in **CSS pixels**.

Key rule: **never “divide by browser zoom”**. If you do, you’ll double-correct and drift when zoom changes.

**Event → canvas logical** (CSS px):
- `x = clientX - rect.left`
- `y = clientY - rect.top`

### 2) Canvas logical coordinates (CSS pixels)
- What the user perceives as “the canvas size”.
- Typically `canvas.getBoundingClientRect().width/height` (CSS px).
- All hit-testing and most drawing math should operate in this space.

### 3) Canvas buffer coordinates (device pixels)
- The actual backing store: `canvas.width/height` (device px).
- Usually `buffer = round(cssSize * devicePixelRatio)`.
- Use DPR scaling on the 2D context so your draw calls can stay in **logical (CSS px)** coordinates:
  - `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` then draw in CSS px.

### 4) Image coordinates (image pixels)
- Coordinates in the source image’s pixel grid (e.g. a WebP tile).
- **Store annotations here** (ROIs, boxes, points) so they remain stable across layout changes, DPR changes, and viewer zoom.

## Recommended single-transform model

Maintain exactly one transform that maps **image → canvas logical** coordinates:

- `scale`: image px → CSS px
- `tx`, `ty`: translation in CSS px
- plus optional viewer-specific zoom/pan (often folded into `scale/tx/ty` or applied as a separate factor)

### Fit-to-view (image → canvas logical)

Given:
- container size in CSS px: `(cw, ch)`
- image size in image px: `(iw, ih)`

Compute:
- `baseScale = min(cw / iw, ch / ih)`
- `scaledW = iw * baseScale`
- `scaledH = ih * baseScale`
- `tx = (cw - scaledW) / 2`
- `ty = (ch - scaledH) / 2`

Apply viewer zoom/pan in the same space:
- `scale = baseScale * zoomLevel`
- `tx += panX`
- `ty += panY`

### Conversions

**Canvas logical → image**
- `ix = (x - tx) / scale`
- `iy = (y - ty) / scale`

**Image → canvas logical**
- `x = tx + ix * scale`
- `y = ty + iy * scale`

All `x/y/tx/ty/scale` above are in **CSS pixels** except `ix/iy` (image pixels).

## Canvas sizing: keep CSS size and buffer size in sync

When the container size or DPR changes:
1) Measure container rect in CSS px (prefer the actual viewer container, not `window.innerWidth`).
2) Set canvas CSS size (style width/height or CSS rules) to match container.
3) Set canvas buffer size:
   - `canvas.width = round(cssWidth * dpr)`
   - `canvas.height = round(cssHeight * dpr)`
4) Scale the context by DPR:
   - `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`
5) Recompute the image→screen transform (fit + viewer zoom/pan), then redraw image + overlays.

## Layout and timing: what to listen to

Layout changes can happen without a `window.resize`:
- sidebars opening/closing
- CSS media query changes (mobile ↔ desktop)
- dynamic content changes affecting flex/grid

Reliable triggers:
- `ResizeObserver` on the viewer container (`#viewer`): catches real layout changes.
- `window.visualViewport.resize`: catches mobile keyboard, iOS Safari UI changes, some zoom/orientation behaviors.
- `window.resize` and `orientationchange`: broad coverage; often sufficient on desktop.

Timing rule: measure after layout has settled.
- Prefer `requestAnimationFrame(() => measureAndRedraw())` in response to these events.
- Avoid relying on “forced reflow” unless you have a proven browser-specific need.

## Common failure modes (and how to avoid them)

- **Mixing spaces**: computing transforms using container size, but drawing using stale canvas size. Always drive both from the same measurement.
- **Double-compensating zoom**: dividing pointer coords by a derived “zoom” factor. Don’t do it; events + DOMRects are already CSS px.
- **DPR drift**: canvas buffer not updated when `devicePixelRatio` changes (moving between monitors, zoom changes). Recompute buffers when DPR changes.
- **Breakpoint drift**: JS and CSS disagree on “mobile mode”. Keep breakpoints single-source-of-truth (e.g., CSS sentinel custom property read by JS).
- **Global CSS collisions**: unscoped rules like `canvas { position: absolute; }` or `div { display: table-row; }` can change stacking/layout and produce “DOM says visible but user can’t click it” bugs. Keep third-party CSS scoped.

## Debug checklist (fast triage)

When something is misaligned:
- Confirm the measured container size (CSS px) matches what you see.
- Log DPR and confirm buffer size is `cssSize * dpr`.
- Log `scale/tx/ty` and verify centering math (`tx ≈ (cw - iw*scale)/2`).
- Verify overlays and image are drawn using the same transform and the same canvas logical coordinate space.
- For “it toggles but doesn’t appear”, check stacking: use `document.elementFromPoint()` inside the sidebar/canvas to confirm what’s on top.
