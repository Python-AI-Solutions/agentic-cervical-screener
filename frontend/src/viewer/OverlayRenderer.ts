/**
 * OverlayRenderer - Handles rendering of overlays (ROIs, AI detections, etc.)
 */

import { state } from './StateManager';
import { overlayCanvas, overlayCtx, getCanvasContainerSize } from './CanvasManager';
import { drawLabeledBoxes } from './overlayAdapters';

/**
 * Draw user-drawn ROIs on the overlay canvas
 */
function drawUserRois(): void {
  if (!overlayCtx || !state.fixedCanvasPixelSize) return;

  const dpr = state.fixedCanvasPixelSize.width / state.fixedCanvasPixelSize.logicalWidth;
  overlayCtx.save();
  overlayCtx.scale(dpr, dpr);

  state.userDrawnRois.forEach((roi, index) => {
    // Convert ROI coordinates to screen coordinates
    const x1 = roi.xmin * state.transform.scale + state.transform.tx;
    const y1 = roi.ymin * state.transform.scale + state.transform.ty;
    const x2 = roi.xmax * state.transform.scale + state.transform.tx;
    const y2 = roi.ymax * state.transform.scale + state.transform.ty;

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

      // Store button position for click detection
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
 */
export function renderOverlays(): void {
  console.log('🎨 renderOverlays called:', { 
    showUserDrawnRois: state.showUserDrawnRois, 
    showAIDetections: state.showAIDetections, 
    lastBoxesLength: state.lastBoxes.length, 
    transform: state.transform 
  });
  
  if (!state.fixedCanvasPixelSize || !overlayCanvas || !overlayCtx) {
    console.warn('⚠️ renderOverlays skipped - fixedCanvasPixelSize not set');
    return;
  }
  
  // Use FIXED pixel size for overlay canvas buffer
  if (overlayCanvas.width !== state.fixedCanvasPixelSize.width || 
      overlayCanvas.height !== state.fixedCanvasPixelSize.height) {
    overlayCanvas.width = state.fixedCanvasPixelSize.width;
    overlayCanvas.height = state.fixedCanvasPixelSize.height;
  }

  // CSS size adapts to current viewport
  const { width: currentContainerWidth, height: currentContainerHeight } = getCanvasContainerSize();
  overlayCanvas.style.width = `${Math.round(currentContainerWidth)}px`;
  overlayCanvas.style.height = `${Math.round(currentContainerHeight)}px`;

  // Use the ORIGINAL DPR from when canvas was sized
  const dpr = state.fixedCanvasPixelSize.width / state.fixedCanvasPixelSize.logicalWidth;
  
  // Reset transform and reapply DPR scaling
  overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
  overlayCtx.scale(dpr, dpr);
  
  // Clear using FIXED logical dimensions
  overlayCtx.clearRect(0, 0, state.fixedCanvasPixelSize.logicalWidth, state.fixedCanvasPixelSize.logicalHeight);

  // Only show user-drawn ROIs
  if (state.showUserDrawnRois) {
    console.log('🎨 Drawing user-drawn ROIs');
    drawUserRois();
  }

  // Show AI detection boxes if enabled
  if (state.showAIDetections) {
    console.log('🎨 Drawing AI detection boxes');
    drawLabeledBoxes(overlayCtx, state.lastBoxes, state.transform);
  } else {
    console.log('🎨 Not drawing AI boxes:', { showAIDetections: state.showAIDetections });
  }
}

