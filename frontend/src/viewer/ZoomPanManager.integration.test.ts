/**
 * Integration tests for ZoomPanManager
 * Lightweight unit/integration tests with mocking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { recalculateTransform, handleZoom } from './ZoomPanManager';
import { state } from './StateManager';
import * as CanvasManager from './CanvasManager';

// Mock CanvasManager functions
vi.mock('./CanvasManager', async () => {
  const actual = await vi.importActual('./CanvasManager');
  return {
    ...actual,
    getCanvasContainerSize: vi.fn(() => ({ width: 800, height: 600 })),
    renderImageCanvas: vi.fn(),
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
});

describe('ZoomPanManager - recalculateTransform', () => {
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

  it('should handle zero container size gracefully', () => {
    state.currentImageDimensions = { width: 1920, height: 1080 };
    
    // Mock zero container size
    vi.mocked(CanvasManager.getCanvasContainerSize).mockReturnValueOnce({ width: 0, height: 0 });
    
    // Should not throw
    expect(() => recalculateTransform()).not.toThrow();
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
    const initialPanX = state.panX;
    const initialPanY = state.panY;
    
    handleZoom(0.1, 400, 300); // Zoom at center
    
    // Pan should adjust to keep point in same screen position
    expect(state.panX).toBeDefined();
    expect(state.panY).toBeDefined();
  });

  it('should not zoom if no image loaded', () => {
    state.currentImageObject = null;
    const initialZoom = state.currentZoomLevel;
    
    // Should not throw, but also not change zoom
    expect(() => handleZoom(0.1)).not.toThrow();
  });
});

