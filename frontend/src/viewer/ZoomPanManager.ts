/**
 * ZoomPanManager - Handles zoom and pan controls
 * Uses CoordinateTransformManager for zoom-aware coordinate conversions
 */

import { state } from './StateManager';
import { overlayCanvas } from './CanvasManager';
import { renderImageCanvas } from './CanvasManager';
import { renderOverlays } from './OverlayRenderer';
import { coordinateTransform } from './CoordinateTransformManager';

/**
 * Recalculate transform based on current zoom level and pan values
 * Delegates to CoordinateTransformManager for zoom-aware calculations
 */
export function recalculateTransform(): void {
  coordinateTransform.recalculateTransform();
}

/**
 * Handle zoom events (wheel scroll or pinch)
 * Uses zoom-aware coordinate conversions for accurate zoom-around-point
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
    // Get old transform before recalculating
    const oldTransform = coordinateTransform.getTransform();
    
    // Convert screen coordinates to canvas logical coordinates (zoom-aware)
    const canvasLogical = coordinateTransform.screenToCanvasLogical(clientX, clientY, overlayCanvas);
    
    // Convert canvas logical coords to image coords at old zoom
    const imageCoords = coordinateTransform.canvasLogicalToImage(canvasLogical.x, canvasLogical.y);

    // Recalculate transform with new zoom level
    recalculateTransform();
    
    // Get new transform
    const newTransform = coordinateTransform.getTransform();
    
    // Calculate new canvas logical position of the same image point
    const newCanvasLogical = coordinateTransform.imageToCanvasLogical(imageCoords.x, imageCoords.y);
    
    // Calculate the difference in canvas logical coordinates
    const deltaX = canvasLogical.x - newCanvasLogical.x;
    const deltaY = canvasLogical.y - newCanvasLogical.y;
    
    // Adjust pan to keep the point at the same screen position
    state.panX += deltaX;
    state.panY += deltaY;
  }

  recalculateTransform();
  renderImageCanvas();
  renderOverlays();

  console.log('🔍 Zoom updated:', {
    oldZoom,
    newZoom: state.currentZoomLevel,
    zoomChange: state.currentZoomLevel - oldZoom,
    pan: { panX: state.panX, panY: state.panY },
    browserZoom: coordinateTransform.getBrowserZoom()
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

