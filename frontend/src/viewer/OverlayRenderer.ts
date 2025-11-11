/**
 * OverlayRenderer - Handles rendering of overlays (ROIs, AI detections, etc.)
 * Uses CoordinateTransformManager for zoom-aware coordinate conversions
 */

import { state } from './StateManager';
import { overlayCanvas, overlayCtx, getCanvasContainerSize } from './CanvasManager';
import { drawLabeledBoxes } from './overlayAdapters';
import { coordinateTransform } from './CoordinateTransformManager';

/**
 * Draw user-drawn ROIs on the overlay canvas
 * Uses CoordinateTransformManager for zoom-aware coordinate conversions
 */
function drawUserRois(): void {
  if (!overlayCtx || !state.fixedCanvasPixelSize) return;

  const dpr = state.fixedCanvasPixelSize.width / state.fixedCanvasPixelSize.logicalWidth;
  overlayCtx.save();
  overlayCtx.scale(dpr, dpr);

  // Get current transform from CoordinateTransformManager
  const transform = coordinateTransform.getTransform();

  state.userDrawnRois.forEach((roi, index) => {
    // Convert ROI image coordinates to canvas logical coordinates using CoordinateTransformManager
    const topLeft = coordinateTransform.imageToCanvasLogical(roi.xmin, roi.ymin);
    const bottomRight = coordinateTransform.imageToCanvasLogical(roi.xmax, roi.ymax);

    const x1 = topLeft.x;
    const y1 = topLeft.y;
    const x2 = bottomRight.x;
    const y2 = bottomRight.y;

    const width = x2 - x1;
    const height = y2 - y1;

    // Highlight hovered ROI
    const isHovered = index === state.hoveredRoiIndex;
    overlayCtx.strokeStyle = isHovered ? '#FFD700' : '#FF6B6B';
    overlayCtx.lineWidth = isHovered ? 3 : 2;
    overlayCtx.setLineDash([]);
    overlayCtx.strokeRect(x1, y1, width, height);

    // Draw label background
    if (roi.label) {
      const text = roi.label;
      overlayCtx.font = '12px sans-serif';
      const metrics = overlayCtx.measureText(text);
      const tw = metrics.width + 8;
      const th = 16;
      const pad = 4;

      overlayCtx.fillStyle = 'rgba(0,0,0,0.55)';
      overlayCtx.fillRect(x1, y1 - th, tw, th);
      overlayCtx.fillStyle = '#fff';
      overlayCtx.fillText(text, x1 + pad, y1 - pad);
    }

    // Draw delete button if hovered
    if (isHovered) {
      const btnSize = 20;
      const btnX = x2 - btnSize - 2;
      const btnY = y1 + 2;

      // Store button position for click detection (in canvas logical coordinates)
      roi._deleteButton = {
        x: btnX,
        y: btnY,
        width: btnSize,
        height: btnSize
      };

      // Draw button background
      overlayCtx.fillStyle = 'rgba(255, 0, 0, 0.8)';
      overlayCtx.fillRect(btnX, btnY, btnSize, btnSize);

      // Draw X
      overlayCtx.strokeStyle = '#fff';
      overlayCtx.lineWidth = 2;
      overlayCtx.beginPath();
      overlayCtx.moveTo(btnX + 5, btnY + 5);
      overlayCtx.lineTo(btnX + btnSize - 5, btnY + btnSize - 5);
      overlayCtx.moveTo(btnX + btnSize - 5, btnY + 5);
      overlayCtx.lineTo(btnX + 5, btnY + btnSize - 5);
      overlayCtx.stroke();
    } else {
      roi._deleteButton = undefined;
    }
  });

  overlayCtx.restore();
}

/**
 * Render all overlays (user ROIs, AI detections, etc.)
 * Uses zoom-aware coordinate system
 */
export function renderOverlays(): void {
  console.log('🎨 renderOverlays called:', { 
    showUserDrawnRois: state.showUserDrawnRois, 
    showAIDetections: state.showAIDetections, 
    lastBoxesLength: state.lastBoxes.length, 
    transform: state.transform,
    browserZoom: coordinateTransform.getBrowserZoom()
  });
  
  if (!state.fixedCanvasPixelSize || !overlayCanvas || !overlayCtx) {
    console.warn('⚠️ renderOverlays skipped - fixedCanvasPixelSize not set');
    return;
  }
  
  // Get current container size (zoom-aware)
  const { width: currentContainerWidth, height: currentContainerHeight } = getCanvasContainerSize();
  
  // Update canvas pixel buffer size based on current container size and DPR
  const dpr = window.devicePixelRatio || 1;
  const actualWidth = Math.round(currentContainerWidth * dpr);
  const actualHeight = Math.round(currentContainerHeight * dpr);
  
  // Update canvas buffer size if needed
  if (overlayCanvas.width !== actualWidth || overlayCanvas.height !== actualHeight) {
    overlayCanvas.width = actualWidth;
    overlayCanvas.height = actualHeight;
    
    // Update fixedCanvasPixelSize to reflect current state
    state.fixedCanvasPixelSize = {
      width: actualWidth,
      height: actualHeight,
      logicalWidth: currentContainerWidth,
      logicalHeight: currentContainerHeight
    };
  }

  // CSS size adapts to current viewport (zoom-aware)
  overlayCanvas.style.width = `${Math.round(currentContainerWidth)}px`;
  overlayCanvas.style.height = `${Math.round(currentContainerHeight)}px`;

  // Reset transform and reapply DPR scaling
  overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
  overlayCtx.scale(dpr, dpr);
  
  // Clear using current logical dimensions (zoom-aware)
  overlayCtx.clearRect(0, 0, currentContainerWidth, currentContainerHeight);

  // Get current transform from CoordinateTransformManager
  const transform = coordinateTransform.getTransform();

  // Only show user-drawn ROIs
  if (state.showUserDrawnRois) {
    console.log('🎨 Drawing user-drawn ROIs');
    drawUserRois();
  }

  // Show AI detection boxes if enabled
  if (state.showAIDetections) {
    console.log('🎨 Drawing AI detection boxes');
    drawLabeledBoxes(overlayCtx, state.lastBoxes, transform);
  } else {
    console.log('🎨 Not drawing AI boxes:', { showAIDetections: state.showAIDetections });
  }
}

