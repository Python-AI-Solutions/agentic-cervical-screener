/**
 * Integration tests for StateManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../viewer/StateManager';

describe('StateManager', () => {
  beforeEach(() => {
    state.reset();
  });

  describe('Initial state', () => {
    it('should have correct initial values', () => {
      expect(state.nv).toBeNull();
      expect(state.currentSlideId).toBeNull();
      expect(state.rois).toEqual([]);
      expect(state.userDrawnRois).toEqual([]);
      expect(state.isDrawing).toBe(false);
      expect(state.currentZoomLevel).toBe(1.0);
      expect(state.panX).toBe(0);
      expect(state.panY).toBe(0);
      expect(state.showAIDetections).toBe(true);
      expect(state.showUserDrawnRois).toBe(true);
    });
  });

  describe('State setters and getters', () => {
    it('should set and get currentSlideId', () => {
      state.currentSlideId = 'SLIDE-001';
      expect(state.currentSlideId).toBe('SLIDE-001');
    });

    it('should set and get userDrawnRois', () => {
      const rois = [
        { xmin: 0, ymin: 0, xmax: 100, ymax: 100, label: 'Test' },
      ];
      state.userDrawnRois = rois;
      expect(state.userDrawnRois).toEqual(rois);
      expect(state.userDrawnRois.length).toBe(1);
    });

    it('should set and get zoom level', () => {
      state.currentZoomLevel = 2.0;
      expect(state.currentZoomLevel).toBe(2.0);
    });

    it('should set and get pan values', () => {
      state.panX = 10;
      state.panY = 20;
      expect(state.panX).toBe(10);
      expect(state.panY).toBe(20);
    });

    it('should set and get drawing state', () => {
      state.isDrawing = true;
      state.drawingStart = { x: 50, y: 50 };
      expect(state.isDrawing).toBe(true);
      expect(state.drawingStart).toEqual({ x: 50, y: 50 });
    });

    it('should manage layer cache', () => {
      const layerData = { fc: {}, colorKind: 'roi' };
      state.layerCache.set('layer-1', layerData);
      expect(state.layerCache.get('layer-1')).toEqual(layerData);
      expect(state.layerCache.size).toBe(1);
    });

    it('should manage visible layers', () => {
      state.visibleLayers.add('layer-1');
      state.visibleLayers.add('layer-2');
      expect(state.visibleLayers.has('layer-1')).toBe(true);
      expect(state.visibleLayers.size).toBe(2);
    });
  });

  describe('reset()', () => {
    it('should reset all state to initial values', () => {
      // Set some state
      state.currentSlideId = 'SLIDE-001';
      state.userDrawnRois = [{ xmin: 0, ymin: 0, xmax: 100, ymax: 100 }];
      state.currentZoomLevel = 2.0;
      state.panX = 10;
      state.panY = 20;
      state.layerCache.set('test', {});
      state.visibleLayers.add('test');
      state.lastBoxes = [{ xmin: 0, ymin: 0, xmax: 50, ymax: 50 }];

      // Reset
      state.reset();

      // Verify reset
      expect(state.currentSlideId).toBeNull();
      expect(state.userDrawnRois).toEqual([]);
      expect(state.currentZoomLevel).toBe(1.0);
      expect(state.panX).toBe(0);
      expect(state.panY).toBe(0);
      expect(state.layerCache.size).toBe(0);
      expect(state.visibleLayers.size).toBe(0);
      expect(state.lastBoxes).toEqual([]);
    });
  });

  describe('Transform state', () => {
    it('should manage transform state', () => {
      state.transform.scale = 1.5;
      state.transform.tx = 100;
      state.transform.ty = 200;
      
      expect(state.transform.scale).toBe(1.5);
      expect(state.transform.tx).toBe(100);
      expect(state.transform.ty).toBe(200);
    });
  });

  describe('Image state', () => {
    it('should manage image dimensions', () => {
      state.currentImageDimensions = { width: 1920, height: 1080 };
      expect(state.currentImageDimensions.width).toBe(1920);
      expect(state.currentImageDimensions.height).toBe(1080);
    });

    it('should manage fixed canvas pixel size', () => {
      const fixedSize = {
        width: 1920,
        height: 1080,
        logicalWidth: 960,
        logicalHeight: 540,
      };
      state.fixedCanvasPixelSize = fixedSize;
      expect(state.fixedCanvasPixelSize).toEqual(fixedSize);
    });
  });
});

