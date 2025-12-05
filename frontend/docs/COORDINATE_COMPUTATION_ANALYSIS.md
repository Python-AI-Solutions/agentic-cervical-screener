/**
 * COORDINATE_COMPUTATION_ANALYSIS.md
 * 
 * Analysis of coordinate computation across different contexts
 */

## Coordinate Spaces

1. **Screen/Viewport Coordinates**: Physical pixel coordinates on the screen
   - Affected by: Browser zoom, device pixel ratio
   - Example: Mouse click at (500, 300) screen pixels

2. **Canvas Logical Coordinates**: CSS-sized coordinate space (what we see)
   - Affected by: Browser zoom (compensated), container size
   - Example: Canvas is 375px CSS width, coordinate (187.5, 0) is center

3. **Canvas Pixel Coordinates**: Actual pixel buffer coordinates
   - Affected by: Device pixel ratio (DPR)
   - Example: Canvas buffer is 750px wide (375 * 2 DPR), coordinate (375, 0) is center

4. **Image Coordinates**: Original image pixel coordinates
   - Not affected by any transforms
   - Example: Image is 1920x1080, coordinate (960, 540) is center

## Transform Flow

```
Screen → Canvas Logical → Image
  ↓           ↓            ↓
(zoom-aware) (transform)  (original)
```

## Issues Identified

1. **Image Canvas CSS Class Missing**: `imageCanvas` is created but doesn't get the `image-canvas` CSS class
2. **Zoom Detection Timing**: May fail on initial load before layout completes
3. **Container Size Calculation**: May return incorrect values if zoom detection fails
4. **DPR vs Browser Zoom Confusion**: DPR scaling happens in canvas context, but browser zoom affects getBoundingClientRect
5. **No Validation**: No checks that transform values are reasonable

## Coordinate Computation Contexts

### Context 1: Image Rendering (`renderImageCanvas`)
- Input: Image coordinates (implicit, full image)
- Output: Canvas logical coordinates (via transform)
- Canvas context: Scaled by DPR
- Issue: Transform must be in logical coordinates, but context is scaled

### Context 2: Drawing Operations (`DrawingManager`)
- Input: Screen coordinates (mouse/touch events)
- Output: Image coordinates (for ROI storage)
- Flow: Screen → Canvas Logical → Image

### Context 3: Overlay Rendering (`OverlayRenderer`)
- Input: Image coordinates (ROIs)
- Output: Canvas logical coordinates (for drawing)
- Flow: Image → Canvas Logical

### Context 4: Zoom/Pan (`ZoomPanManager`)
- Input: Screen coordinates (zoom point)
- Output: Updated transform (affects all conversions)
- Flow: Screen → Canvas Logical → Image → Recalculate Transform

## Robust Strategy

1. **Single Source of Truth**: CoordinateTransformManager handles all conversions
2. **Zoom Detection**: Multiple fallback methods, cached with invalidation
3. **Validation**: Check that container size > 0, transform values are reasonable
4. **CSS Positioning**: Ensure imageCanvas has proper CSS classes
5. **DPR Handling**: Always scale context by DPR, work in logical coordinates
6. **Error Recovery**: If zoom detection fails, use fallback (1.0) and log warning
7. **Timing**: Use requestAnimationFrame for layout-dependent operations

