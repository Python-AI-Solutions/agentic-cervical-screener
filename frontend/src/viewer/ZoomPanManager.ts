/**
 * ZoomPanManager - Handles zoom and pan controls
 */

import { state } from './StateManager';
import { overlayCanvas } from './CanvasManager';
import { getCanvasContainerSize } from './CanvasManager';
import { renderImageCanvas } from './CanvasManager';
import { renderOverlays } from './OverlayRenderer';

/**
 * Recalculate transform based on current zoom level and pan values
 */
export function recalculateTransform(): void {
  if (!state.currentImageDimensions || !state.currentImageDimensions.width) {
    console.warn('⚠️ recalculateTransform: image dimensions not set');
    return;
  }

  const { width: containerWidthRaw, height: containerHeightRaw } = getCanvasContainerSize();
  const containerWidth = Math.round(containerWidthRaw);
  const containerHeight = Math.round(containerHeightRaw);

  if (containerWidth === 0 || containerHeight === 0) {
    console.warn('⚠️ recalculateTransform: container has zero size');
    return;
  }

  const imageWidth = state.currentImageDimensions.width;
  const imageHeight = state.currentImageDimensions.height;

  // Base scale (fit to window at zoom 1.0)
  const baseScale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);

  // Apply zoom multiplier
  const scale = baseScale * state.currentZoomLevel;

  // Calculate scaled dimensions
  const scaledWidth = imageWidth * scale;
  const scaledHeight = imageHeight * scale;

  // Start with base centering
  let tx = (containerWidth - scaledWidth) / 2;
  let ty = (containerHeight - scaledHeight) / 2;

  // Apply pan offsets (limited to prevent dragging too far)
  const maxPanX = Math.abs(scaledWidth - containerWidth) / 2;
  const maxPanY = Math.abs(scaledHeight - containerHeight) / 2;

  if (scaledWidth > containerWidth) {
    tx += Math.max(-maxPanX, Math.min(maxPanX, state.panX));
  }
  if (scaledHeight > containerHeight) {
    ty += Math.max(-maxPanY, Math.min(maxPanY, state.panY));
  }

  state.transform.scale = scale;
  state.transform.tx = tx;
  state.transform.ty = ty;

  console.log('🔍 Transform recalculated:', {
    zoomLevel: state.currentZoomLevel,
    baseScale,
    finalScale: scale,
    pan: { panX: state.panX, panY: state.panY },
    transform: state.transform,
    containerSize: { width: containerWidth, height: containerHeight },
    imageSize: { width: imageWidth, height: imageHeight }
  });
}

/**
 * Handle zoom events (wheel scroll or pinch)
 */
export function handleZoom(deltaZoom: number, clientX?: number, clientY?: number): void {
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 5.0;
  const oldZoom = state.currentZoomLevel;

  state.currentZoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.currentZoomLevel + deltaZoom));

  if (state.currentZoomLevel === oldZoom) {
    return; // No change
  }

  // If we have client coordinates, try to zoom around that point
  if (clientX !== undefined && clientY !== undefined && overlayCanvas) {
    const rect = overlayCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Convert screen coords to image coords at old zoom
    const imageX = (x - state.transform.tx) / state.transform.scale;
    const imageY = (y - state.transform.ty) / state.transform.scale;

    recalculateTransform();

    // Calculate new screen position of the same image point
    const newScreenX = imageX * state.transform.scale + state.transform.tx;
    const newScreenY = imageY * state.transform.scale + state.transform.ty;

    // Adjust pan to keep the point at the same screen position
    state.panX += (x - newScreenX);
    state.panY += (y - newScreenY);
  }

  recalculateTransform();
  renderImageCanvas();
  renderOverlays();

  console.log('🔍 Zoom updated:', {
    oldZoom,
    newZoom: state.currentZoomLevel,
    zoomChange: state.currentZoomLevel - oldZoom,
    pan: { panX: state.panX, panY: state.panY }
  });
}

/**
 * Setup zoom and pan handlers (wheel, pinch, etc.)
 */
export function setupZoomHandlers(): void {
  if (!overlayCanvas) return;

  // Wheel zoom (mouse scroll)
  overlayCanvas.addEventListener('wheel', (e) => {
    if (!state.currentImageObject) return; // Only zoom if image is loaded
    
    e.preventDefault();
    
    // Scroll up = zoom in (positive), down = zoom out (negative)
    const zoomDelta = e.deltaY < 0 ? 0.1 : -0.1;
    handleZoom(zoomDelta, e.clientX, e.clientY);
  }, { passive: false });

  // Touch pinch zoom
  overlayCanvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      state.lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
    }
  }, { passive: false });

  overlayCanvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && state.lastTouchDistance > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const currentDistance = Math.sqrt(dx * dx + dy * dy);
      const distanceDelta = currentDistance - state.lastTouchDistance;

      // Pinch sensitivity: 100px of pinch = 0.2 zoom change
      const zoomDelta = distanceDelta / 500;
      handleZoom(zoomDelta);

      state.lastTouchDistance = currentDistance;
    }
  }, { passive: false });

  overlayCanvas.addEventListener('touchend', () => {
    state.lastTouchDistance = 0;
  }, { passive: false });
}

