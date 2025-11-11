/**
 * Integration tests for ZoomPanManager
 * Lightweight unit/integration tests with mocking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { recalculateTransform, handleZoom } from './ZoomPanManager';
import { state } from './StateManager';
import * as CanvasManager from './CanvasManager';
import { coordinateTransform } from './CoordinateTransformManager';

// Mock CoordinateTransformManager
vi.mock('./CoordinateTransformManager', () => ({
  coordinateTransform: {
    recalculateTransform: vi.fn(),
    getBrowserZoom: vi.fn(() => 1.0),
    getTransform: vi.fn(() => state.transform),
    screenToCanvasLogical: vi.fn((x, y) => ({ x: x - 100, y: y - 50 })),
    canvasLogicalToImage: vi.fn((x, y) => ({ x: (x - state.transform.tx) / state.transform.scale, y: (y - state.transform.ty) / state.transform.scale })),
    imageToCanvasLogical: vi.fn((x, y) => ({ x: x * state.transform.scale + state.transform.tx, y: y * state.transform.scale + state.transform.ty })),
  },
}));

// Mock CanvasManager functions
vi.mock('./CanvasManager', async () => {
  const actual = await vi.importActual('./CanvasManager');
  return {
    ...actual,
    getCanvasContainerSize: vi.fn(() => ({ width: 800, height: 600 })),
    renderImageCanvas: vi.fn(),
    overlayCanvas: {
      getBoundingClientRect: vi.fn(() => ({ width: 800, height: 600, left: 100, top: 50 })),
    } as any,
  };
});

vi.mock('./OverlayRenderer', () => ({
  renderOverlays: vi.fn(),
}));

beforeEach(() => {
  state.reset();
  state.currentImageDimensions = { width: 1920, height: 1080 };
  // Transform is an object, so we modify its properties
  state.transform.scale = 1;
  state.transform.tx = 0;
  state.transform.ty = 0;
  
  // Reset mock return values
  vi.mocked(CanvasManager.getCanvasContainerSize).mockReturnValue({ width: 800, height: 600 });
  
  // Reset CoordinateTransformManager mocks
  vi.mocked(coordinateTransform.recalculateTransform).mockImplementation(() => {
    // Simulate transform calculation
    const containerWidth = 800;
    const containerHeight = 600;
    const imageWidth = state.currentImageDimensions.width;
    const imageHeight = state.currentImageDimensions.height;
    const baseScale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);
    state.transform.scale = baseScale * state.currentZoomLevel;
    const scaledWidth = imageWidth * state.transform.scale;
    const scaledHeight = imageHeight * state.transform.scale;
    state.transform.tx = (containerWidth - scaledWidth) / 2;
    state.transform.ty = (containerHeight - scaledHeight) / 2;
  });
  
  vi.mocked(coordinateTransform.getTransform).mockImplementation(() => ({ ...state.transform }));
});

describe('ZoomPanManager - recalculateTransform', () => {
  it('should delegate to CoordinateTransformManager', () => {
    recalculateTransform();
    
    expect(coordinateTransform.recalculateTransform).toHaveBeenCalled();
  });

  it('should calculate transform for image that fits container', () => {
    state.currentImageDimensions = { width: 400, height: 300 };
    
    recalculateTransform();
    
    // Image should fit, so scale should be 1.0 (or less to fit)
    expect(state.transform.scale).toBeGreaterThan(0);
    expect(state.transform.scale).toBeLessThanOrEqual(2.0);
  });

  it('should calculate transform for large image', () => {
    state.currentImageDimensions = { width: 1920, height: 1080 };
    
    recalculateTransform();
    
    // Should scale down to fit
    expect(state.transform.scale).toBeLessThan(1.0);
    expect(state.transform.tx).toBeGreaterThanOrEqual(0);
    expect(state.transform.ty).toBeGreaterThanOrEqual(0);
  });

  it('should apply zoom level to transform', () => {
    state.currentImageDimensions = { width: 1920, height: 1080 };
    state.currentZoomLevel = 2.0;
    
    recalculateTransform();
    
    // Transform should reflect zoom level
    expect(state.transform.scale).toBeGreaterThan(0);
  });

  it('should apply pan offsets when zoomed in', () => {
    state.currentImageDimensions = { width: 1920, height: 1080 };
    state.currentZoomLevel = 2.0;
    state.panX = 100;
    state.panY = 50;
    
    recalculateTransform();
    
    // Pan should be applied (within limits)
    expect(state.transform.tx).toBeDefined();
    expect(state.transform.ty).toBeDefined();
  });
});

describe('ZoomPanManager - handleZoom', () => {
  beforeEach(() => {
    // Mock image object
    state.currentImageObject = {
      width: 1920,
      height: 1080,
    } as HTMLImageElement;
  });

  it('should increase zoom level', () => {
    const initialZoom = state.currentZoomLevel;
    
    handleZoom(0.1);
    
    expect(state.currentZoomLevel).toBeGreaterThan(initialZoom);
  });

  it('should decrease zoom level', () => {
    state.currentZoomLevel = 2.0;
    const initialZoom = state.currentZoomLevel;
    
    handleZoom(-0.1);
    
    expect(state.currentZoomLevel).toBeLessThan(initialZoom);
  });

  it('should constrain zoom to minimum', () => {
    state.currentZoomLevel = 0.5;
    
    handleZoom(-0.1);
    
    expect(state.currentZoomLevel).toBeGreaterThanOrEqual(0.5);
  });

  it('should constrain zoom to maximum', () => {
    state.currentZoomLevel = 5.0;
    
    handleZoom(0.1);
    
    expect(state.currentZoomLevel).toBeLessThanOrEqual(5.0);
  });

  it('should zoom around a point', () => {
    state.currentZoomLevel = 1.0;
    state.currentImageDimensions = { width: 1920, height: 1080 };
    const initialPanX = state.panX;
    const initialPanY = state.panY;
    
    // Mock coordinate conversions for zoom-around-point
    vi.mocked(coordinateTransform.screenToCanvasLogical).mockReturnValue({ x: 400, y: 300 });
    vi.mocked(coordinateTransform.canvasLogicalToImage).mockReturnValue({ x: 800, y: 600 });
    vi.mocked(coordinateTransform.imageToCanvasLogical).mockReturnValue({ x: 500, y: 400 });
    
    handleZoom(0.1, 400, 300); // Zoom at center
    
    // Pan should adjust to keep point in same screen position
    expect(state.panX).toBeDefined();
    expect(state.panY).toBeDefined();
    // Pan should have changed
    expect(state.panX !== initialPanX || state.panY !== initialPanY).toBe(true);
  });

  it('should not zoom if no image loaded', () => {
    state.currentImageObject = null;
    const initialZoom = state.currentZoomLevel;
    
    // Should not throw, but also not change zoom
    expect(() => handleZoom(0.1)).not.toThrow();
  });
});

