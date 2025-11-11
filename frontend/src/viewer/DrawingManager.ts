/**
 * DrawingManager - Handles drawing/ROI functionality
 */

import { state } from './StateManager';
import { overlayCanvas } from './CanvasManager';
import { renderOverlays } from './OverlayRenderer';

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
    // Convert to image coordinates
    const imageRect = {
      xmin: (rect.x - state.transform.tx) / state.transform.scale,
      ymin: (rect.y - state.transform.ty) / state.transform.scale,
      xmax: (rect.x + rect.width - state.transform.tx) / state.transform.scale,
      ymax: (rect.y + rect.height - state.transform.ty) / state.transform.scale
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
  const rect = overlayCanvas!.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
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
  if (!state.isDrawing) return;
  const rect = overlayCanvas!.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  updateDrawing(x, y);
}

function handleMouseMoveHover(e: MouseEvent): void {
  const rect = overlayCanvas!.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  // Check if hovering over any ROI rectangle
  let newHoveredIndex = -1;
  for (let i = 0; i < state.userDrawnRois.length; i++) {
    const roi = state.userDrawnRois[i];
    const x1 = roi.xmin * state.transform.scale + state.transform.tx;
    const y1 = roi.ymin * state.transform.scale + state.transform.ty;
    const x2 = roi.xmax * state.transform.scale + state.transform.tx;
    const y2 = roi.ymax * state.transform.scale + state.transform.ty;
    
    if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
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
  if (!state.isDrawing) return;
  const rect = overlayCanvas!.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  finishDrawing(x, y);
}

function handleTouchStart(e: TouchEvent): void {
  e.preventDefault();
  const rect = overlayCanvas!.getBoundingClientRect();
  const touch = e.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  
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
  const rect = overlayCanvas!.getBoundingClientRect();
  const touch = e.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  
  let newHoveredIndex = -1;
  for (let i = 0; i < state.userDrawnRois.length; i++) {
    const roi = state.userDrawnRois[i];
    const x1 = roi.xmin * state.transform.scale + state.transform.tx;
    const y1 = roi.ymin * state.transform.scale + state.transform.ty;
    const x2 = roi.xmax * state.transform.scale + state.transform.tx;
    const y2 = roi.ymax * state.transform.scale + state.transform.ty;
    
    if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
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
  if (!state.isDrawing) return;
  const rect = overlayCanvas!.getBoundingClientRect();
  const touch = e.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  updateDrawing(x, y);
}

function handleTouchEnd(e: TouchEvent): void {
  e.preventDefault();
  if (!state.isDrawing) return;
  const rect = overlayCanvas!.getBoundingClientRect();
  const touch = e.changedTouches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  finishDrawing(x, y);
}

