/**
 * DrawingManager - Handles drawing/ROI functionality
 * Uses CoordinateTransformManager for zoom-aware coordinate conversions
 */

import { state } from './StateManager';
import { overlayCanvas } from './CanvasManager';
import { renderOverlays } from './OverlayRenderer';
import { coordinateTransform } from './CoordinateTransformManager';

// Available labels for cervical cytology
export const CERVICAL_LABELS = [
  'Negative for intraepithelial lesion',
  'ASC-US',
  'ASC-H',
  'LSIL',
  'HSIL',
  'SCC'
];

/**
 * Show label selection dialog (will be replaced with Tailwind Elements modal)
 */
export function showLabelSelectionDialog(
  imageRect: { xmin: number; ymin: number; xmax: number; ymax: number },
  onConfirm: (label: string) => void
): void {
  // Create modal dialog - TODO: Replace with Tailwind Elements Modal component
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-[10000]';
  
  const dialog = document.createElement('div');
  dialog.className = 'bg-medical-dark-primary border border-medical-dark-border rounded-medical p-4 max-w-md w-[90%] max-h-[80vh] overflow-y-auto';
  
  dialog.innerHTML = `
    <h3 class="m-0 mb-3 text-medical-text-primary">Select Labels</h3>
    <div class="mb-3">
      ${CERVICAL_LABELS.map((label, index) => `
        <label class="block mb-2 cursor-pointer text-medical-text-primary">
          <input type="radio" name="label" value="${label}" ${index === 0 ? 'checked' : ''} class="mr-2">
          ${label}
        </label>
      `).join('')}
    </div>
    <div class="flex gap-2 justify-end">
      <button id="cancelLabel" class="medical-button">Cancel</button>
      <button id="confirmLabel" class="medical-button bg-blue-600 border-blue-600 text-white hover:bg-blue-700">Add</button>
    </div>
  `;
  
  modal.appendChild(dialog);
  document.body.appendChild(modal);
  
  // Event listeners
  document.getElementById('cancelLabel')?.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  document.getElementById('confirmLabel')?.addEventListener('click', () => {
    const selected = (dialog.querySelector('input[name="label"]:checked') as HTMLInputElement)?.value;
    if (selected) {
      onConfirm(selected);
    }
    document.body.removeChild(modal);
  });
}

/**
 * Start drawing
 */
export function startDrawing(x: number, y: number): void {
  console.log('Starting drawing', { x, y });
  state.isDrawing = true;
  state.drawingStart = { x, y };
  state.drawingRect = { x, y, width: 0, height: 0 };
}

/**
 * Update drawing rectangle
 */
export function updateDrawing(x: number, y: number): void {
  if (!state.isDrawing || !state.drawingStart) return;
  
  state.drawingRect = {
    x: Math.min(state.drawingStart.x, x),
    y: Math.min(state.drawingStart.y, y),
    width: Math.abs(x - state.drawingStart.x),
    height: Math.abs(y - state.drawingStart.y)
  };
  
  // Redraw overlays and current drawing
  renderOverlays();
  drawCurrentRectangle();
}

/**
 * Finish drawing
 * Converts canvas logical coordinates to image coordinates using CoordinateTransformManager
 */
export function finishDrawing(x: number, y: number): void {
  if (!state.isDrawing || !state.drawingStart) return;
  
  const rect = {
    x: Math.min(state.drawingStart.x, x),
    y: Math.min(state.drawingStart.y, y),
    width: Math.abs(x - state.drawingStart.x),
    height: Math.abs(y - state.drawingStart.y)
  };
  
  // Only add if rectangle is large enough
  if (rect.width > 10 && rect.height > 10) {
    // Convert canvas logical coordinates to image coordinates using CoordinateTransformManager
    const topLeft = coordinateTransform.canvasLogicalToImage(rect.x, rect.y);
    const bottomRight = coordinateTransform.canvasLogicalToImage(rect.x + rect.width, rect.y + rect.height);
    
    const imageRect = {
      xmin: topLeft.x,
      ymin: topLeft.y,
      xmax: bottomRight.x,
      ymax: bottomRight.y
    };
    
    // Show label selection dialog
    showLabelSelectionDialog(imageRect, (label: string) => {
      state.userDrawnRois.push({
        ...imageRect,
        label
      });
      renderOverlays();
    });
  }
  
  state.isDrawing = false;
  state.drawingStart = null;
  state.drawingRect = null;
  renderOverlays();
}

/**
 * Draw current rectangle being drawn
 */
function drawCurrentRectangle(): void {
  if (!state.drawingRect || !overlayCanvas) return;
  
  const overlayCtx = overlayCanvas.getContext('2d');
  if (!overlayCtx) return;
  
  overlayCtx.save();
  overlayCtx.strokeStyle = '#FF6B6B';
  overlayCtx.lineWidth = 2;
  overlayCtx.setLineDash([5, 5]);
  overlayCtx.strokeRect(
    state.drawingRect.x, 
    state.drawingRect.y, 
    state.drawingRect.width, 
    state.drawingRect.height
  );
  overlayCtx.restore();
}

/**
 * Setup drawing mode event handlers
 */
export function setupDrawingMode(): void {
  if (!overlayCanvas) return;
  
  // Enable pointer events for drawing
  overlayCanvas.style.pointerEvents = 'auto';
  overlayCanvas.style.cursor = 'crosshair';
  
  // Mouse events for drawing
  overlayCanvas.addEventListener('mousedown', handleMouseDown);
  overlayCanvas.addEventListener('mousemove', handleMouseMove);
  overlayCanvas.addEventListener('mouseup', handleMouseUp);
  overlayCanvas.addEventListener('mouseleave', handleMouseUp);
  
  // Mouse events for hover detection
  overlayCanvas.addEventListener('mousemove', handleMouseMoveHover);
  overlayCanvas.addEventListener('mouseleave', () => {
    if (state.hoveredRoiIndex !== -1) {
      state.hoveredRoiIndex = -1;
      renderOverlays();
    }
  });
  
  // Touch events for mobile
  overlayCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  overlayCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  overlayCanvas.addEventListener('touchend', handleTouchEnd, { passive: false });
  
  // Touch events for hover detection on mobile
  overlayCanvas.addEventListener('touchmove', handleTouchMoveHover, { passive: false });
}

function handleMouseDown(e: MouseEvent): void {
  if (!overlayCanvas) return;
  
  // Convert screen coordinates to canvas logical coordinates (zoom-aware)
  const canvasLogical = coordinateTransform.screenToCanvasLogical(e.clientX, e.clientY, overlayCanvas);
  const x = canvasLogical.x;
  const y = canvasLogical.y;
  
  // Check if clicking on a delete button
  if (state.hoveredRoiIndex >= 0 && state.hoveredRoiIndex < state.userDrawnRois.length) {
    const roi = state.userDrawnRois[state.hoveredRoiIndex];
    if (roi._deleteButton) {
      const deleteBtn = roi._deleteButton;
      if (x >= deleteBtn.x && x <= deleteBtn.x + deleteBtn.width &&
          y >= deleteBtn.y && y <= deleteBtn.y + deleteBtn.height) {
        state.userDrawnRois.splice(state.hoveredRoiIndex, 1);
        state.hoveredRoiIndex = -1;
        renderOverlays();
        return;
      }
    }
  }
  
  startDrawing(x, y);
}

function handleMouseMove(e: MouseEvent): void {
  if (!state.isDrawing || !overlayCanvas) return;
  
  // Convert screen coordinates to canvas logical coordinates (zoom-aware)
  const canvasLogical = coordinateTransform.screenToCanvasLogical(e.clientX, e.clientY, overlayCanvas);
  updateDrawing(canvasLogical.x, canvasLogical.y);
}

function handleMouseMoveHover(e: MouseEvent): void {
  if (!overlayCanvas) return;
  
  // Convert screen coordinates to canvas logical coordinates (zoom-aware)
  const canvasLogical = coordinateTransform.screenToCanvasLogical(e.clientX, e.clientY, overlayCanvas);
  const x = canvasLogical.x;
  const y = canvasLogical.y;
  
  // Check if hovering over any ROI rectangle
  // Convert ROI image coordinates to canvas logical coordinates for comparison
  let newHoveredIndex = -1;
  
  for (let i = 0; i < state.userDrawnRois.length; i++) {
    const roi = state.userDrawnRois[i];
    // Convert ROI image coordinates to canvas logical coordinates
    const topLeft = coordinateTransform.imageToCanvasLogical(roi.xmin, roi.ymin);
    const bottomRight = coordinateTransform.imageToCanvasLogical(roi.xmax, roi.ymax);
    
    if (x >= topLeft.x && x <= bottomRight.x && y >= topLeft.y && y <= bottomRight.y) {
      newHoveredIndex = i;
      break;
    }
  }
  
  if (newHoveredIndex !== state.hoveredRoiIndex) {
    state.hoveredRoiIndex = newHoveredIndex;
    renderOverlays();
  }
}

function handleMouseUp(e: MouseEvent): void {
  if (!state.isDrawing || !overlayCanvas) return;
  
  // Convert screen coordinates to canvas logical coordinates (zoom-aware)
  const canvasLogical = coordinateTransform.screenToCanvasLogical(e.clientX, e.clientY, overlayCanvas);
  finishDrawing(canvasLogical.x, canvasLogical.y);
}

function handleTouchStart(e: TouchEvent): void {
  e.preventDefault();
  if (!overlayCanvas) return;
  
  const touch = e.touches[0];
  // Convert screen coordinates to canvas logical coordinates (zoom-aware)
  const canvasLogical = coordinateTransform.screenToCanvasLogical(touch.clientX, touch.clientY, overlayCanvas);
  const x = canvasLogical.x;
  const y = canvasLogical.y;
  
  // Check if clicking on a delete button
  if (state.hoveredRoiIndex >= 0 && state.hoveredRoiIndex < state.userDrawnRois.length) {
    const roi = state.userDrawnRois[state.hoveredRoiIndex];
    if (roi._deleteButton) {
      const deleteBtn = roi._deleteButton;
      if (x >= deleteBtn.x && x <= deleteBtn.x + deleteBtn.width &&
          y >= deleteBtn.y && y <= deleteBtn.y + deleteBtn.height) {
        state.userDrawnRois.splice(state.hoveredRoiIndex, 1);
        state.hoveredRoiIndex = -1;
        renderOverlays();
        return;
      }
    }
  }
  
  startDrawing(x, y);
}

function handleTouchMoveHover(e: TouchEvent): void {
  e.preventDefault();
  if (!overlayCanvas) return;
  
  const touch = e.touches[0];
  // Convert screen coordinates to canvas logical coordinates (zoom-aware)
  const canvasLogical = coordinateTransform.screenToCanvasLogical(touch.clientX, touch.clientY, overlayCanvas);
  const x = canvasLogical.x;
  const y = canvasLogical.y;
  
  // Check if hovering over any ROI rectangle
  // Convert ROI image coordinates to canvas logical coordinates for comparison
  let newHoveredIndex = -1;
  
  for (let i = 0; i < state.userDrawnRois.length; i++) {
    const roi = state.userDrawnRois[i];
    // Convert ROI image coordinates to canvas logical coordinates
    const topLeft = coordinateTransform.imageToCanvasLogical(roi.xmin, roi.ymin);
    const bottomRight = coordinateTransform.imageToCanvasLogical(roi.xmax, roi.ymax);
    
    if (x >= topLeft.x && x <= bottomRight.x && y >= topLeft.y && y <= bottomRight.y) {
      newHoveredIndex = i;
      break;
    }
  }
  
  if (newHoveredIndex !== state.hoveredRoiIndex) {
    state.hoveredRoiIndex = newHoveredIndex;
    renderOverlays();
  }
}

function handleTouchMove(e: TouchEvent): void {
  e.preventDefault();
  if (!state.isDrawing || !overlayCanvas) return;
  
  const touch = e.touches[0];
  // Convert screen coordinates to canvas logical coordinates (zoom-aware)
  const canvasLogical = coordinateTransform.screenToCanvasLogical(touch.clientX, touch.clientY, overlayCanvas);
  updateDrawing(canvasLogical.x, canvasLogical.y);
}

function handleTouchEnd(e: TouchEvent): void {
  e.preventDefault();
  if (!state.isDrawing || !overlayCanvas) return;
  
  const touch = e.changedTouches[0];
  // Convert screen coordinates to canvas logical coordinates (zoom-aware)
  const canvasLogical = coordinateTransform.screenToCanvasLogical(touch.clientX, touch.clientY, overlayCanvas);
  finishDrawing(canvasLogical.x, canvasLogical.y);
}

