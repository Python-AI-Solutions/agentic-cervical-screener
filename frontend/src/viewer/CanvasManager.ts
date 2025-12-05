/**
 * CanvasManager - Handles canvas sizing, rendering, and resize operations
 */

import { state } from './StateManager';
import { coordinateTransform } from './CoordinateTransformManager';

const glCanvas = document.getElementById('glCanvas') as HTMLCanvasElement;
const overlayCanvas = document.getElementById('overlayCanvas') as HTMLCanvasElement;
const overlayCtx = overlayCanvas?.getContext('2d');

/**
 * Returns the size of the Niivue viewer container independent of any inline
 * sizing we might apply to the canvases themselves.
 * Uses zoom-aware coordinate system.
 */
export function getCanvasContainerSize(): { width: number; height: number } {
  return coordinateTransform.getContainerSize();
}

export function ensureImageCanvas(): HTMLCanvasElement | null {
  if (!glCanvas) return null;
  let imageCanvas = document.getElementById('imageCanvas') as HTMLCanvasElement;
  if (!imageCanvas) {
    imageCanvas = document.createElement('canvas');
    imageCanvas.id = 'imageCanvas';
    imageCanvas.className = 'image-canvas'; // Ensure proper CSS positioning (absolute, top-0, left-0)
    glCanvas.parentNode?.insertBefore(imageCanvas, overlayCanvas);
  }
  return imageCanvas;
}

/**
 * Update canvas size to match container - NiiVue style responsive handling
 */
export function updateCanvasSize(): boolean {
  if (!glCanvas || !overlayCanvas) return false;

  const prevGlWidthStyle = glCanvas.style.width;
  const prevGlHeightStyle = glCanvas.style.height;
  const prevOverlayWidthStyle = overlayCanvas.style.width;
  const prevOverlayHeightStyle = overlayCanvas.style.height;
  const imageCanvas = document.getElementById('imageCanvas') as HTMLCanvasElement;
  const prevImageWidthStyle = imageCanvas?.style.width ?? '';
  const prevImageHeightStyle = imageCanvas?.style.height ?? '';

  // Let CSS dictate the new layout before we measure
  glCanvas.style.width = '';
  glCanvas.style.height = '';
  overlayCanvas.style.width = '';
  overlayCanvas.style.height = '';
  if (imageCanvas) {
    imageCanvas.style.width = '';
    imageCanvas.style.height = '';
  }

  const { width, height } = getCanvasContainerSize();

  // Defensive check: if canvas hasn't been laid out yet, skip sizing
  if (width === 0 || height === 0) {
    glCanvas.style.width = prevGlWidthStyle;
    glCanvas.style.height = prevGlHeightStyle;
    overlayCanvas.style.width = prevOverlayWidthStyle;
    overlayCanvas.style.height = prevOverlayHeightStyle;
    if (imageCanvas) {
      imageCanvas.style.width = prevImageWidthStyle;
      imageCanvas.style.height = prevImageHeightStyle;
    }
    console.warn('⚠️ Canvas not laid out yet, skipping size update');
    return false;
  }

  // Account for device pixel ratio for crisp rendering
  // Note: DPR is separate from browser zoom - DPR is device-specific, browser zoom is user-controlled
  const dpr = window.devicePixelRatio || 1;
  const browserZoom = coordinateTransform.getBrowserZoom();
  
  // Use zoom-aware dimensions for canvas sizing
  const roundedWidth = Math.round(width);
  const roundedHeight = Math.round(height);
  const actualWidth = Math.round(roundedWidth * dpr);
  const actualHeight = Math.round(roundedHeight * dpr);

  let sizeChanged = false;

  // Only update heavy pixel buffers if something actually changed
  if (glCanvas.width !== actualWidth || glCanvas.height !== actualHeight) {
    glCanvas.width = actualWidth;
    glCanvas.height = actualHeight;
    overlayCanvas.width = actualWidth;
    overlayCanvas.height = actualHeight;
    if (imageCanvas) {
      imageCanvas.width = actualWidth;
      imageCanvas.height = actualHeight;
    }

    // Scale overlay context for high DPI
    if (overlayCtx) {
      overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
      overlayCtx.scale(dpr, dpr);
    }

    console.log('✅ Canvas size updated:', {
      displaySize: { width, height },
      actualPixels: { width: actualWidth, height: actualHeight },
      dpr,
    });
    sizeChanged = true;
  }

  const styleWidthPx = `${roundedWidth}px`;
  const styleHeightPx = `${roundedHeight}px`;
  glCanvas.style.width = styleWidthPx;
  glCanvas.style.height = styleHeightPx;
  overlayCanvas.style.width = styleWidthPx;
  overlayCanvas.style.height = styleHeightPx;
  if (imageCanvas) {
    imageCanvas.style.width = styleWidthPx;
    imageCanvas.style.height = styleHeightPx;
  }

  return sizeChanged;
}

/**
 * Fit overlay to image - initializes transform using CoordinateTransformManager
 * Now uses dynamic sizing that accounts for browser zoom
 */
export function fitOverlayToImage(imageWidth: number, imageHeight: number): void {
  const { width: containerWidth, height: containerHeight } = getCanvasContainerSize();

  if (containerWidth === 0 || containerHeight === 0) {
    console.warn('⚠️ fitOverlayToImage skipped - container has zero size');
    return;
  }

  // Store canvas pixel size info for rendering (but don't freeze - allow dynamic updates)
  const dpr = window.devicePixelRatio || 1;
  state.fixedCanvasPixelSize = {
    width: Math.round(containerWidth * dpr),
    height: Math.round(containerHeight * dpr),
    logicalWidth: containerWidth,
    logicalHeight: containerHeight
  };

  // Use CoordinateTransformManager to calculate initial transform
  // This ensures browser zoom is accounted for
  coordinateTransform.recalculateTransform();

  console.log('✅ Canvas size and transform initialized:', {
    imageSize: { width: imageWidth, height: imageHeight },
    canvasPixelSize: state.fixedCanvasPixelSize,
    transform: state.transform,
    browserZoom: coordinateTransform.getBrowserZoom()
  });
}

/**
 * Render image to image canvas
 * Uses zoom-aware coordinate system
 */
export function renderImageCanvas(): void {
  if (!state.currentImageObject || !state.fixedCanvasPixelSize) {
    return;
  }

  // Hide the drop zone when image is loaded
  const dropZone = document.getElementById('dropZone');
  if (dropZone) {
    dropZone.style.display = 'none';
  }

  const imageCanvas = ensureImageCanvas();
  if (!imageCanvas) return;

  // Get current container size (zoom-aware)
  const { width: currentContainerWidth, height: currentContainerHeight } = getCanvasContainerSize();
  
  // Update canvas pixel buffer size based on current container size and DPR
  const dpr = window.devicePixelRatio || 1;
  const actualWidth = Math.round(currentContainerWidth * dpr);
  const actualHeight = Math.round(currentContainerHeight * dpr);
  
  if (imageCanvas.width !== actualWidth || imageCanvas.height !== actualHeight) {
    imageCanvas.width = actualWidth;
    imageCanvas.height = actualHeight;
    
    // Update fixedCanvasPixelSize to reflect current state
    state.fixedCanvasPixelSize = {
      width: actualWidth,
      height: actualHeight,
      logicalWidth: currentContainerWidth,
      logicalHeight: currentContainerHeight
    };
  }

  // CSS size adapts to current viewport (zoom-aware)
  // Use 100% instead of explicit pixels to work with CSS w-full h-full
  // This ensures the canvas fills its container properly
  imageCanvas.style.width = '100%';
  imageCanvas.style.height = '100%';

  // CRITICAL: Force a reflow to ensure CSS sizing is applied before reading clientWidth
  // Without this, clientWidth/clientHeight might return 0 or stale values
  void imageCanvas.offsetHeight; // Force reflow

  const ctx = imageCanvas.getContext('2d');
  if (!ctx) return;

  // Get the ACTUAL rendered size of the canvas (after CSS sizing)
  // This is critical - we need to use the actual rendered size, not the container size
  const actualRenderedWidth = imageCanvas.clientWidth || imageCanvas.offsetWidth || currentContainerWidth;
  const actualRenderedHeight = imageCanvas.clientHeight || imageCanvas.offsetHeight || currentContainerHeight;

  // Validate we got reasonable values
  if (actualRenderedWidth === 0 || actualRenderedHeight === 0) {
    console.error('❌ renderImageCanvas: canvas has zero rendered size', {
      clientWidth: imageCanvas.clientWidth,
      clientHeight: imageCanvas.clientHeight,
      offsetWidth: imageCanvas.offsetWidth,
      offsetHeight: imageCanvas.offsetHeight,
      currentContainerWidth,
      currentContainerHeight,
      styleWidth: imageCanvas.style.width,
      styleHeight: imageCanvas.style.height
    });
    return;
  }

  // Reset and apply DPR scaling
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, actualRenderedWidth, actualRenderedHeight);

  const imgWidth = state.currentImageDimensions?.width || state.currentImageObject.width;
  const imgHeight = state.currentImageDimensions?.height || state.currentImageObject.height;

  // CRITICAL: Recalculate transform using the ACTUAL rendered canvas size
  // This ensures the transform matches the actual canvas dimensions, not just
  // the calculated container size. This is essential for proper centering.
  coordinateTransform.recalculateTransform(actualRenderedWidth, actualRenderedHeight);
  
  // Get current transform (zoom-aware)
  const transform = coordinateTransform.getTransform();

  // Validate transform before using
  if (!transform || !isFinite(transform.scale) || !isFinite(transform.tx) || !isFinite(transform.ty)) {
    console.error('❌ renderImageCanvas: invalid transform', transform);
    return;
  }

  // Calculate screen position using transform
  // Note: ctx is scaled by DPR, so we work in logical coordinates
  const drawX = transform.tx;
  const drawY = transform.ty;
  const drawWidth = imgWidth * transform.scale;
  const drawHeight = imgHeight * transform.scale;

  // Validate draw dimensions
  if (!isFinite(drawX) || !isFinite(drawY) || !isFinite(drawWidth) || !isFinite(drawHeight)) {
    console.error('❌ renderImageCanvas: invalid draw dimensions', {
      drawX, drawY, drawWidth, drawHeight,
      transform, imgWidth, imgHeight
    });
    return;
  }

  // Draw image at calculated screen coordinates
  // The context is already scaled by DPR, so coordinates are in logical space
  ctx.drawImage(state.currentImageObject, drawX, drawY, drawWidth, drawHeight);
  
  console.log('🖼️ Image rendered:', {
    drawPosition: { x: drawX, y: drawY },
    drawSize: { width: drawWidth, height: drawHeight },
    containerSize: { width: currentContainerWidth, height: currentContainerHeight },
    actualRenderedSize: { width: actualRenderedWidth, height: actualRenderedHeight },
    canvasBufferSize: { width: actualWidth, height: actualHeight },
    canvasElementSize: { 
      clientWidth: imageCanvas.clientWidth, 
      clientHeight: imageCanvas.clientHeight,
      offsetWidth: imageCanvas.offsetWidth,
      offsetHeight: imageCanvas.offsetHeight
    },
    transform,
    dpr,
    imageSize: { width: imgWidth, height: imgHeight },
    // Calculate expected center position for debugging
    expectedCenterX: (actualRenderedWidth - drawWidth) / 2,
    expectedCenterY: (actualRenderedHeight - drawHeight) / 2,
    actualCenterX: drawX + drawWidth / 2,
    actualCenterY: drawY + drawHeight / 2
  });
}

/**
 * Handle canvas resize
 * Now properly handles browser zoom and window resizing
 */
export function handleCanvasResize(renderOverlays: () => void): void {
  const sizeChanged = updateCanvasSize();

  if (state.currentImageObject) {
    // Recalculate transform to account for browser zoom and container size changes
    coordinateTransform.recalculateTransform();
    renderImageCanvas();
    renderOverlays();
    return;
  }

  if (sizeChanged && (state.lastBoxes.length > 0 || state.layerCache.size > 0 || state.userDrawnRois.length > 0)) {
    renderOverlays();
  }
}

// Debounced resize handler
let resizeTimeout: ReturnType<typeof setTimeout>;
export function debouncedResize(renderOverlays: () => void, nv: any): void {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    requestAnimationFrame(() => {
      handleCanvasResize(renderOverlays);
      if (nv && typeof nv.resize === 'function') {
        nv.resize();
      }
    });
  }, 100);
}

export { glCanvas, overlayCanvas, overlayCtx };

