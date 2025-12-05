# Robust Coordinate Computation Strategy

## Overview

This document outlines the robust strategy for handling coordinate computations across different contexts (screen, canvas logical, canvas pixel, and image coordinates) to ensure images display correctly on all devices, especially mobile with browser zoom.

## Key Issues Identified and Fixed

### 1. Image Canvas CSS Positioning
**Issue**: The `imageCanvas` element was created dynamically but didn't have the `image-canvas` CSS class applied, which provides `absolute top-0 left-0` positioning.

**Fix**: Added `imageCanvas.className = 'image-canvas'` in `ensureImageCanvas()` to ensure proper CSS positioning.

### 2. Browser Zoom Detection Robustness
**Issue**: Zoom detection could fail on mobile devices or during initial page load when layout wasn't complete, leading to incorrect container size calculations.

**Fix**: Added multiple fallback methods:
- Primary: Compare `getBoundingClientRect()` with `getComputedStyle()`
- Fallback 1: Use `window.outerWidth / window.innerWidth` ratio
- Fallback 2: Use `window.visualViewport.scale` if available
- Fallback 3: Return cached zoom value
- Validation: Ensure zoom is between 0.25x and 5x, and is finite

### 3. Container Size Calculation
**Issue**: Container size could return 0 or invalid values if zoom detection failed or layout wasn't ready.

**Fix**: 
- Added validation to ensure dimensions are reasonable
- Added fallback to use direct measurement if zoom-aware calculation fails
- Return 0 only if all methods fail

### 4. Transform Validation
**Issue**: Transform values could be invalid (NaN, Infinity) if calculations failed, causing images to render incorrectly.

**Fix**: Added comprehensive validation:
- Validate image dimensions are positive and finite
- Validate container dimensions are positive
- Validate scale calculations are finite and positive
- Validate transform values (tx, ty, scale) are finite before applying
- Log detailed error information when validation fails

### 5. Image Rendering Validation
**Issue**: Images could be drawn with invalid coordinates, causing them to appear in wrong positions.

**Fix**: Added validation before drawing:
- Validate transform exists and has valid values
- Validate draw dimensions are finite
- Log detailed rendering information for debugging

## Coordinate Space Definitions

### Screen/Viewport Coordinates
- Physical pixel coordinates on the screen
- Affected by: Browser zoom, device pixel ratio
- Used for: Mouse/touch events

### Canvas Logical Coordinates
- CSS-sized coordinate space (what users see)
- Affected by: Browser zoom (compensated), container size
- Used for: Transform calculations, drawing operations
- **This is the primary coordinate space we work in**

### Canvas Pixel Coordinates
- Actual pixel buffer coordinates
- Affected by: Device pixel ratio (DPR)
- Used for: Canvas buffer sizing
- **Handled automatically by scaling context by DPR**

### Image Coordinates
- Original image pixel coordinates
- Not affected by any transforms
- Used for: ROI storage, image operations

## Coordinate Conversion Flow

```
Screen Coordinates
    ↓ (screenToCanvasLogical - accounts for browser zoom)
Canvas Logical Coordinates
    ↓ (canvasLogicalToImage - uses transform)
Image Coordinates
```

## Robust Strategy Principles

### 1. Single Source of Truth
- `CoordinateTransformManager` handles all coordinate conversions
- All modules use the same conversion methods
- Transform is calculated once and reused

### 2. Defensive Programming
- Validate all inputs before calculations
- Check for edge cases (zero sizes, invalid values)
- Use fallback methods when primary detection fails
- Log warnings/errors for debugging

### 3. Zoom Awareness
- All coordinate conversions account for browser zoom
- Container size calculations compensate for zoom
- Transform calculations use zoom-aware dimensions

### 4. DPR Handling
- Canvas context is scaled by DPR for crisp rendering
- All drawing operations work in logical coordinates
- Canvas buffer size = logical size × DPR

### 5. Error Recovery
- If zoom detection fails, use cached value or fallback (1.0)
- If container size is 0, try direct measurement
- If transform is invalid, don't render (log error)
- Never render with invalid coordinates

### 6. Timing Considerations
- Use `requestAnimationFrame` for layout-dependent operations
- Check container size before calculating transform
- Recalculate transform on resize events

## Implementation Details

### Browser Zoom Detection
```typescript
// Primary method: Compare getBoundingClientRect with computed styles
const zoom = rect.width / computedWidth;

// Fallbacks:
// 1. window.outerWidth / window.innerWidth
// 2. window.visualViewport.scale
// 3. Cached value

// Validation: Ensure zoom is between 0.25x and 5x
```

### Container Size Calculation
```typescript
// Get zoom-aware bounding rect
const zoomAwareRect = getZoomAwareBoundingClientRect(container);

// Validate dimensions
if (width === 0 || height === 0) {
  // Fallback: Direct measurement
  const computed = getComputedStyle(container);
  return { width: computed.width, height: computed.height };
}
```

### Transform Calculation
```typescript
// Validate inputs
if (containerWidth === 0 || imageWidth === 0) return;

// Calculate scale
const baseScale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);

// Validate scale
if (!isFinite(baseScale) || baseScale <= 0) return;

// Calculate transform
const scale = baseScale * zoomLevel;
const tx = (containerWidth - scaledWidth) / 2;
const ty = (containerHeight - scaledHeight) / 2;

// Validate transform
if (!isFinite(tx) || !isFinite(ty) || !isFinite(scale)) return;
```

### Image Rendering
```typescript
// Get transform
const transform = coordinateTransform.getTransform();

// Validate transform
if (!transform || !isFinite(transform.scale)) return;

// Calculate draw position (in logical coordinates)
const drawX = transform.tx;
const drawY = transform.ty;
const drawWidth = imgWidth * transform.scale;
const drawHeight = imgHeight * transform.scale;

// Validate draw dimensions
if (!isFinite(drawX) || !isFinite(drawY)) return;

// Draw (context is already scaled by DPR)
ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
```

## Testing Strategy

1. **Unit Tests**: Test coordinate conversions in isolation
2. **Integration Tests**: Test full rendering pipeline
3. **Mobile Viewport Tests**: Test different mobile screen sizes
4. **Zoom Level Tests**: Test at 50%, 100%, 150%, 200% browser zoom
5. **Edge Case Tests**: Test with very large/small images, portrait images

## Debugging

All coordinate operations log detailed information:
- Transform recalculation logs container size, image size, scale, and position
- Image rendering logs draw position, size, and transform
- Errors log full context for debugging

Use browser console to trace coordinate flow:
1. Check "🔍 Transform recalculated" logs
2. Check "🖼️ Image rendered" logs
3. Check for "⚠️" warnings or "❌" errors

## Future Improvements

1. **Visual Debugging**: Add overlay showing coordinate spaces
2. **Performance**: Cache zoom detection results more aggressively
3. **Accessibility**: Ensure coordinate system works with screen readers
4. **Touch Optimization**: Optimize coordinate conversions for touch events

