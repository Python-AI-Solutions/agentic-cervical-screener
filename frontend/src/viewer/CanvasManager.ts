/**
 * CanvasManager - Handles canvas sizing, rendering, and resize operations
 */

import { state } from './StateManager';

const glCanvas = document.getElementById('glCanvas') as HTMLCanvasElement;
const overlayCanvas = document.getElementById('overlayCanvas') as HTMLCanvasElement;
const overlayCtx = overlayCanvas?.getContext('2d');

/**
 * Returns the size of the Niivue viewer container independent of any inline
 * sizing we might apply to the canvases themselves.
 */
export function getCanvasContainerSize(): { width: number; height: number } {
  if (!glCanvas) return { width: 0, height: 0 };
  const container = glCanvas.parentElement || glCanvas;
  const rect = container.getBoundingClientRect();
  if (rect.width && rect.height) {
    return { width: rect.width, height: rect.height };
  }
  return {
    width: glCanvas.clientWidth || 0,
    height: glCanvas.clientHeight || 0,
  };
}

export function ensureImageCanvas(): HTMLCanvasElement | null {
  if (!glCanvas) return null;
  let imageCanvas = document.getElementById('imageCanvas') as HTMLCanvasElement;
  if (!imageCanvas) {
    imageCanvas = document.createElement('canvas');
    imageCanvas.id = 'imageCanvas';
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
  const dpr = window.devicePixelRatio || 1;
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
 * Fit overlay to image - sets transform and fixed canvas size
 */
export function fitOverlayToImage(imageWidth: number, imageHeight: number): void {
  const { width: containerWidthRaw, height: containerHeightRaw } = getCanvasContainerSize();
  const containerWidth = Math.round(containerWidthRaw);
  const containerHeight = Math.round(containerHeightRaw);

  if (containerWidth === 0 || containerHeight === 0) {
    console.warn('⚠️ fitOverlayToImage skipped - container has zero size');
    return;
  }

  // CRITICAL: FREEZE canvas pixel dimensions at image load
  const dpr = window.devicePixelRatio || 1;
  state.fixedCanvasPixelSize = {
    width: Math.round(containerWidth * dpr),
    height: Math.round(containerHeight * dpr),
    logicalWidth: containerWidth,
    logicalHeight: containerHeight
  };

  // Calculate scale to fit image in container
  const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);

  // Center the image
  const scaledWidth = imageWidth * scale;
  const scaledHeight = imageHeight * scale;
  const tx = (containerWidth - scaledWidth) / 2;
  const ty = (containerHeight - scaledHeight) / 2;

  // Set transform ONCE
  state.transform.scale = scale;
  state.transform.tx = tx;
  state.transform.ty = ty;

  console.log('✅ Canvas size and transform FROZEN:', {
    imageSize: { width: imageWidth, height: imageHeight },
    fixedCanvasPixelSize: state.fixedCanvasPixelSize,
    transform: { scale, tx, ty }
  });
}

/**
 * Render image to image canvas
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

  // Use FIXED pixel size for canvas buffer
  if (imageCanvas.width !== state.fixedCanvasPixelSize.width || 
      imageCanvas.height !== state.fixedCanvasPixelSize.height) {
    imageCanvas.width = state.fixedCanvasPixelSize.width;
    imageCanvas.height = state.fixedCanvasPixelSize.height;
  }

  // CSS size adapts to current viewport
  const { width: currentContainerWidth, height: currentContainerHeight } = getCanvasContainerSize();
  imageCanvas.style.width = `${Math.round(currentContainerWidth)}px`;
  imageCanvas.style.height = `${Math.round(currentContainerHeight)}px`;

  const ctx = imageCanvas.getContext('2d');
  if (!ctx) return;

  // Use the ORIGINAL DPR from when canvas was sized
  const dpr = state.fixedCanvasPixelSize.width / state.fixedCanvasPixelSize.logicalWidth;
  
  // Reset and apply DPR scaling
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, state.fixedCanvasPixelSize.logicalWidth, state.fixedCanvasPixelSize.logicalHeight);

  const imgWidth = state.currentImageDimensions?.width || state.currentImageObject.width;
  const imgHeight = state.currentImageDimensions?.height || state.currentImageObject.height;

  // Calculate screen position using transform
  const drawX = state.transform.tx;
  const drawY = state.transform.ty;
  const drawWidth = imgWidth * state.transform.scale;
  const drawHeight = imgHeight * state.transform.scale;

  // Draw image at calculated screen coordinates
  ctx.drawImage(state.currentImageObject, drawX, drawY, drawWidth, drawHeight);
}

/**
 * Handle canvas resize
 */
export function handleCanvasResize(renderOverlays: () => void): void {
  const sizeChanged = updateCanvasSize();

  if (state.currentImageObject) {
    // DO NOT recalculate transform on browser zoom/resize
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

