/**
 * Unit tests for DrawingManager
 * Tests coordinate conversions and ROI drawing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { startDrawing, updateDrawing, finishDrawing } from './DrawingManager';
import { state } from './StateManager';
import { coordinateTransform } from './CoordinateTransformManager';

// Mock CoordinateTransformManager
vi.mock('./CoordinateTransformManager', () => ({
  coordinateTransform: {
    screenToCanvasLogical: vi.fn((x, y) => ({ x: x - 100, y: y - 50 })),
    canvasLogicalToImage: vi.fn((x, y) => {
      const transform = state.transform;
      return {
        x: (x - transform.tx) / transform.scale,
        y: (y - transform.ty) / transform.scale,
      };
    }),
    imageToCanvasLogical: vi.fn((x, y) => {
      const transform = state.transform;
      return {
        x: x * transform.scale + transform.tx,
        y: y * transform.scale + transform.ty,
      };
    }),
    getTransform: vi.fn(() => state.transform),
  },
}));

// Mock OverlayRenderer
vi.mock('./OverlayRenderer', () => ({
  renderOverlays: vi.fn(),
}));

// Mock CanvasManager
vi.mock('./CanvasManager', () => ({
  overlayCanvas: {
    getContext: vi.fn(() => ({
      save: vi.fn(),
      restore: vi.fn(),
      strokeRect: vi.fn(),
      strokeStyle: '',
      lineWidth: 0,
      setLineDash: vi.fn(),
    })),
  },
}));

beforeEach(() => {
  state.reset();
  state.currentImageDimensions = { width: 1920, height: 1080 };
  state.transform.scale = 0.5;
  state.transform.tx = 100;
  state.transform.ty = 50;
  
  vi.clearAllMocks();
});

describe('DrawingManager - Drawing Operations', () => {
  it('should start drawing at given coordinates', () => {
    startDrawing(100, 200);
    
    expect(state.isDrawing).toBe(true);
    expect(state.drawingStart).toEqual({ x: 100, y: 200 });
    expect(state.drawingRect).toEqual({ x: 100, y: 200, width: 0, height: 0 });
  });

  it('should update drawing rectangle', () => {
    startDrawing(100, 100);
    updateDrawing(200, 150);
    
    expect(state.drawingRect).toEqual({
      x: 100,
      y: 100,
      width: 100,
      height: 50,
    });
  });

  it('should handle drawing from bottom-right to top-left', () => {
    startDrawing(200, 200);
    updateDrawing(100, 100);
    
    expect(state.drawingRect).toEqual({
      x: 100,
      y: 100,
      width: 100,
      height: 100,
    });
  });

  it('should finish drawing and convert to image coordinates', () => {
    startDrawing(100, 100);
    updateDrawing(200, 150);
    
    // Mock coordinate conversion
    vi.mocked(coordinateTransform.canvasLogicalToImage)
      .mockReturnValueOnce({ x: 0, y: 0 }) // top-left
      .mockReturnValueOnce({ x: 200, y: 100 }); // bottom-right
    
    finishDrawing(200, 150);
    
    expect(state.isDrawing).toBe(false);
    expect(state.drawingStart).toBeNull();
    expect(state.drawingRect).toBeNull();
  });

  it('should not finish drawing if rectangle is too small', () => {
    startDrawing(100, 100);
    updateDrawing(105, 105); // Only 5x5 pixels
    
    finishDrawing(105, 105);
    
    // Should not add ROI
    expect(state.userDrawnRois.length).toBe(0);
    expect(state.isDrawing).toBe(false);
  });

  it('should convert canvas logical coordinates to image coordinates correctly', () => {
    // Canvas logical (200, 150)
    // Transform: scale=0.5, tx=100, ty=50
    // Expected image: (200, 200)
    vi.mocked(coordinateTransform.canvasLogicalToImage)
      .mockReturnValueOnce({ x: 200, y: 200 })
      .mockReturnValueOnce({ x: 400, y: 300 });
    
    startDrawing(200, 150);
    finishDrawing(300, 200);
    
    // Should have called canvasLogicalToImage for conversion
    expect(coordinateTransform.canvasLogicalToImage).toHaveBeenCalled();
  });
});

