/**
 * End-to-end integration tests for viewer workflows
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchCase, resolveUri } from '../services/cqaiClient';
import { state } from '../viewer/StateManager';

beforeEach(() => {
  // Reset state
  state.reset();
  
  // Mock window.__ENV__
  (window as any).__ENV__ = { API_BASE: '' };
  
  // Mock fetch
  global.fetch = vi.fn();
});

describe('End-to-End Workflows', () => {
  describe('Case Loading Workflow', () => {
    it('should load a case and resolve image URI correctly', async () => {
      const mockCaseData = {
        case_id: 'DEMO-002',
        slides: [{
          slide_id: 'SLIDE-002',
          uri: 'images/case2.png',
          title: 'Case 2',
        }],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCaseData,
      });

      // Load case
      const caseData = await fetchCase('DEMO-002');
      
      // Verify case loaded
      expect(caseData).toEqual(mockCaseData);
      expect((caseData as any).slides[0].uri).toBe('images/case2.png');
      
      // Resolve image URI
      const imageUri = resolveUri((caseData as any).slides[0].uri);
      expect(imageUri).toBe('/images/case2.png');
    });

    it('should handle case loading with multiple slides', async () => {
      const mockCaseData = {
        case_id: 'DEMO-003',
        slides: [
          { slide_id: 'SLIDE-003A', uri: 'images/case3a.png' },
          { slide_id: 'SLIDE-003B', uri: 'images/case3b.png' },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCaseData,
      });

      const caseData = await fetchCase('DEMO-003');
      expect((caseData as any).slides.length).toBe(2);
    });

    it('should cache case data', async () => {
      const mockCaseData = {
        case_id: 'DEMO-001',
        slides: [{ slide_id: 'SLIDE-001', uri: 'images/test.png' }],
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockCaseData,
      });

      // Load case twice
      await fetchCase('DEMO-001');
      await fetchCase('DEMO-001');

      // Fetch should be called twice (cache is in viewer/index.ts, not here)
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Image Loading Workflow', () => {
    it('should resolve all case image URIs correctly', async () => {
      const cases = [
        { caseId: 'DEMO-001', expectedUri: 'images/test-image.png' },
        { caseId: 'DEMO-002', expectedUri: 'images/case2.png' },
        { caseId: 'DEMO-003', expectedUri: 'images/case3.png' },
        { caseId: 'DEMO-004', expectedUri: 'images/case4.png' },
      ];

      for (const { caseId, expectedUri } of cases) {
        const mockCaseData = {
          case_id: caseId,
          slides: [{ slide_id: `SLIDE-${caseId.slice(-1)}`, uri: expectedUri }],
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockCaseData,
        });

        const caseData = await fetchCase(caseId);
        const resolvedUri = resolveUri((caseData as any).slides[0].uri);
        
        expect(resolvedUri).toBe(`/${expectedUri}`);
      }
    });
  });

  describe('State Management Workflow', () => {
    it('should manage state through a complete workflow', () => {
      // Initial state
      expect(state.userDrawnRois.length).toBe(0);
      expect(state.currentZoomLevel).toBe(1.0);
      
      // Add ROIs
      state.userDrawnRois = [
        { xmin: 0, ymin: 0, xmax: 100, ymax: 100, label: 'ROI 1' },
        { xmin: 200, ymin: 200, xmax: 300, ymax: 300, label: 'ROI 2' },
      ];
      expect(state.userDrawnRois.length).toBe(2);
      
      // Zoom in
      state.currentZoomLevel = 2.0;
      expect(state.currentZoomLevel).toBe(2.0);
      
      // Pan
      state.panX = 50;
      state.panY = 50;
      expect(state.panX).toBe(50);
      expect(state.panY).toBe(50);
      
      // Reset
      state.reset();
      expect(state.userDrawnRois.length).toBe(0);
      expect(state.currentZoomLevel).toBe(1.0);
      expect(state.panX).toBe(0);
      expect(state.panY).toBe(0);
    });

    it('should manage layer visibility state', () => {
      // Add layers
      state.visibleLayers.add('layer-1');
      state.visibleLayers.add('layer-2');
      expect(state.visibleLayers.size).toBe(2);
      
      // Toggle layer
      state.visibleLayers.delete('layer-1');
      expect(state.visibleLayers.has('layer-1')).toBe(false);
      expect(state.visibleLayers.has('layer-2')).toBe(true);
      
      // Reset
      state.reset();
      expect(state.visibleLayers.size).toBe(0);
    });
  });

  describe('Error Handling Workflow', () => {
    it('should handle case fetch errors gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(fetchCase('DEMO-999')).rejects.toThrow('case fetch failed: 404');
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchCase('DEMO-001')).rejects.toThrow('Network error');
    });
  });

  describe('Multiple Case Loading Workflow', () => {
    it('should load and switch between multiple cases', async () => {
      const cases = [
        {
          caseId: 'DEMO-001',
          data: { case_id: 'DEMO-001', slides: [{ slide_id: 'SLIDE-001', uri: 'images/test.png' }] },
        },
        {
          caseId: 'DEMO-002',
          data: { case_id: 'DEMO-002', slides: [{ slide_id: 'SLIDE-002', uri: 'images/case2.png' }] },
        },
      ];

      for (const { caseId, data } of cases) {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => data,
        });

        const caseData = await fetchCase(caseId);
        expect((caseData as any).case_id).toBe(caseId);
        
        // Reset state between cases
        state.reset();
      }
    });
  });
});

