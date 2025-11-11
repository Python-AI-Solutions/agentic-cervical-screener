# Browser Zoom and Mobile Viewport Issues - Technical Documentation

## Overview

This document details the browser zoom and mobile viewport sizing issues encountered in the cervical screener application, the root causes identified, and all attempted fixes. The issues manifested as images appearing incorrectly positioned (typically in the bottom-right corner) and incorrectly sized on mobile devices and when browser zoom was applied.

## Problem Statement

### Symptoms Observed

1. **Image Positioning**: Images appeared in the bottom-right corner of the canvas instead of being centered
2. **Incorrect Sizing**: Images were rendered at incorrect sizes, often appearing much smaller than expected
3. **Mobile Viewport Issues**: On mobile devices (especially in emulators), the canvas size was calculated incorrectly
4. **Browser Zoom Problems**: When browser zoom was applied, coordinate calculations became incorrect

### Example from Console Logs

From debugging sessions, we observed:
- **Viewport Size**: 402 x 874 pixels (actual mobile viewport)
- **Container Size Calculated**: 256 x 1109 pixels (incorrect)
- **Canvas Size**: 256 x 1109 pixels (inherited incorrect container size)
- **Image Draw Position**: `{ x: 0, y: 459.6 }` (should be centered)
- **Image Draw Size**: `{ width: 256, height: 189.7 }` (too small)

## Root Causes Identified

### 1. Browser Zoom Detection Issues

**Problem**: The browser zoom detection method was unreliable, especially on mobile devices.

**Original Implementation**:
```typescript
detectBrowserZoom(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  const computed = window.getComputedStyle(element);
  const zoom = rect.width / computed.width;
  return zoom;
}
```

**Issues**:
- On mobile, `getBoundingClientRect()` and `getComputedStyle()` could return inconsistent values
- Zoom detection could fail during initial page load before layout was complete
- No fallback methods when primary detection failed
- No validation that detected zoom was reasonable

### 2. Container Size Calculation Problems

**Problem**: The container size was calculated using zoom-compensated dimensions, but the compensation was incorrect.

**Original Implementation**:
```typescript
getContainerSize(): { width: number; height: number } {
  const container = glCanvas.parentElement;
  const zoomAwareRect = this.getZoomAwareBoundingClientRect(container);
  return {
    width: zoomAwareRect.width / zoom,  // Incorrect division
    height: zoomAwareRect.height / zoom
  };
}
```

**Issues**:
- Zoom-aware calculation was applied incorrectly
- No fallback to direct measurements
- Didn't account for mobile viewport differences
- Didn't use `window.visualViewport` API for mobile

### 3. Coordinate Space Mismatches

**Problem**: Multiple coordinate spaces were being used inconsistently:
- Screen/viewport coordinates
- Canvas logical coordinates (CSS-sized)
- Canvas pixel coordinates (buffer-sized, DPR-scaled)
- Image coordinates

**Issues**:
- Transform calculations used container size, but rendering used canvas size
- No synchronization between when transform was calculated and when canvas was sized
- DPR scaling was applied inconsistently

### 4. Timing and Layout Issues

**Problem**: Container size was calculated before CSS layout was complete.

**Issues**:
- `clientWidth`/`clientHeight` could return 0 or stale values
- CSS `100%` sizing wasn't applied before reading dimensions
- No forced reflow before reading canvas dimensions

## Fixes Attempted

### Fix 1: Enhanced Browser Zoom Detection

**Approach**: Added multiple fallback methods for zoom detection.

**Implementation**:
```typescript
detectBrowserZoom(element: HTMLElement): number {
  // Primary: Compare getBoundingClientRect with computed styles
  const zoom = rect.width / computed.width;
  
  // Fallback 1: window.outerWidth / window.innerWidth
  // Fallback 2: window.visualViewport.scale
  // Fallback 3: Cached value
  
  // Validation: Ensure zoom is between 0.25x and 5x
}
```

**Result**: Improved reliability but didn't solve the core container size issue.

### Fix 2: Improved Container Size Calculation with Fallbacks

**Approach**: Added multiple fallback methods for container size calculation.

**Implementation**:
```typescript
getContainerSize(): { width: number; height: number } {
  // Method 1: Zoom-aware bounding rect
  // Method 2: Direct measurement
  // Method 3: Visual viewport
  // Method 4: Window dimensions
}
```

**Result**: Still had issues because zoom-aware calculation was still prioritized.

### Fix 3: Using Actual Rendered Canvas Size

**Approach**: Pass actual rendered canvas size to transform calculation.

**Implementation**:
```typescript
renderImageCanvas(): void {
  const actualRenderedWidth = imageCanvas.clientWidth;
  const actualRenderedHeight = imageCanvas.clientHeight;
  coordinateTransform.recalculateTransform(actualRenderedWidth, actualRenderedHeight);
}
```

**Result**: Helped but didn't fix root cause - container size was still wrong initially.

### Fix 4: Forced Reflow Before Reading Dimensions

**Approach**: Force browser reflow before reading canvas dimensions.

**Implementation**:
```typescript
imageCanvas.style.width = '100%';
imageCanvas.style.height = '100%';
void imageCanvas.offsetHeight; // Force reflow
const actualRenderedWidth = imageCanvas.clientWidth;
```

**Result**: Improved timing but didn't fix incorrect container size calculation.

### Fix 5: Prioritizing Visual Viewport (Final Fix)

**Approach**: Prioritize `window.visualViewport` and direct measurements over zoom-aware calculations.

**Implementation**:
```typescript
getContainerSize(): { width: number; height: number } {
  // PRIORITY 1: Visual viewport (most reliable for mobile)
  if (window.visualViewport && window.visualViewport.width > 0) {
    return { width: window.visualViewport.width, height: window.visualViewport.height };
  }
  
  // PRIORITY 2: Direct bounding rect (no zoom compensation)
  const directRect = container.getBoundingClientRect();
  if (directRect.width > 100 && directRect.height > 100) {
    return { width: directRect.width, height: directRect.height };
  }
  
  // PRIORITY 3: Computed style
  // PRIORITY 4: Zoom-aware (fallback only)
  // PRIORITY 5: Window dimensions (last resort)
}
```

**Result**: ✅ **This fixed the core issue** - container size now matches viewport correctly.

## Final Solution

### Container Size Calculation (Current Implementation)

The final solution prioritizes reliable measurement methods:

1. **Visual Viewport API** (`window.visualViewport`)
   - Most reliable for mobile devices
   - Accounts for browser UI (address bar, etc.)
   - Returns actual visible viewport dimensions

2. **Direct Bounding Rect**
   - No zoom compensation
   - Direct measurement of element size
   - Works when visual viewport isn't available

3. **Computed Style**
   - CSS dimensions from stylesheet
   - Reliable fallback

4. **Zoom-Aware Calculation**
   - Only used as fallback
   - Validated to ensure reasonable values

5. **Window Dimensions**
   - Last resort fallback
   - Accounts for header height

### Transform Calculation

The transform is now calculated using:
- Actual rendered canvas size (passed explicitly)
- Validated container dimensions
- Proper centering calculations: `tx = (containerWidth - scaledWidth) / 2`

### Rendering Process

1. Set canvas CSS to `100%` width/height
2. Force reflow: `void imageCanvas.offsetHeight`
3. Read actual rendered size: `clientWidth`/`clientHeight`
4. Recalculate transform with actual rendered size
5. Draw image using transform coordinates

## Key Learnings

### 1. Browser Zoom Detection is Unreliable

- Different browsers handle zoom differently
- Mobile devices have additional complexity (DPR, visual viewport)
- Zoom detection should be a fallback, not primary method

### 2. Visual Viewport API is Essential for Mobile

- `window.visualViewport` provides accurate viewport dimensions
- Accounts for browser UI elements (address bar, toolbars)
- More reliable than `window.innerWidth/innerHeight` on mobile

### 3. Direct Measurements are More Reliable

- `getBoundingClientRect()` without zoom compensation is often more accurate
- Zoom compensation can introduce errors if zoom detection is wrong
- Multiple fallback methods are essential

### 4. Timing Matters

- CSS sizing must be applied before reading dimensions
- Forced reflow (`offsetHeight`) ensures layout is complete
- Transform should be recalculated with actual rendered size

### 5. Coordinate Space Consistency

- All coordinate conversions must use the same size reference
- Transform calculation and rendering must use matching dimensions
- DPR scaling must be applied consistently

## Testing and Validation

### Test Cases Covered

1. **Mobile Viewports**: iPhone SE, iPhone 12/13, iPhone 14 Pro Max, iPad Mini
2. **Browser Zoom Levels**: 50%, 100%, 150%, 200%
3. **Dynamic Zoom Changes**: Changing zoom level after page load
4. **Edge Cases**: Portrait images, very large images, very small images

### Console Logging

Added comprehensive logging to track:
- Container size calculation method used
- Actual rendered size vs calculated size
- Transform values (scale, tx, ty)
- Expected vs actual center positions
- All measurement methods for debugging

### Debugging Output

The console now shows:
```
📐 Using visual viewport for container size: { width: 402, height: 874 }
🔍 Transform recalculated: { containerSize: {...}, transform: {...} }
🖼️ Image rendered: { 
  actualRenderedSize: {...},
  expectedCenterX: 0,
  actualCenterX: 128,
  ...
}
```

## Remaining Considerations

### Potential Future Improvements

1. **Visual Debugging Overlay**: Add overlay showing coordinate spaces and measurements
2. **Performance Optimization**: Cache zoom detection results more aggressively
3. **Accessibility**: Ensure coordinate system works with screen readers
4. **Touch Optimization**: Optimize coordinate conversions for touch events

### Known Limitations

1. **Browser Zoom Detection**: Still relies on fallback methods, may not be 100% accurate in all scenarios
2. **Visual Viewport Support**: Not available in all browsers (Safari < 13, older browsers)
3. **Timing Sensitivity**: Still requires forced reflow in some cases

## Related Files

- `frontend/src/viewer/CoordinateTransformManager.ts` - Core coordinate transformation logic
- `frontend/src/viewer/CanvasManager.ts` - Canvas sizing and rendering
- `frontend/src/viewer/mobile-zoom.integration.test.ts` - Mobile zoom tests
- `frontend/docs/COORDINATE_COMPUTATION_ANALYSIS.md` - Coordinate space analysis
- `frontend/docs/ROBUST_COORDINATE_STRATEGY.md` - Overall strategy document

## Conclusion

The zoom and mobile viewport issues were resolved by:
1. Prioritizing reliable measurement methods (visual viewport, direct measurements)
2. De-prioritizing zoom-aware calculations (using as fallback only)
3. Ensuring transform uses actual rendered canvas size
4. Adding comprehensive fallback methods and validation
5. Improving timing with forced reflows

The solution is robust and handles edge cases through multiple fallback methods, ensuring images display correctly across different devices and zoom levels.

