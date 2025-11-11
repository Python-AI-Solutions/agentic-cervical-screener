/**
 * Integration tests for image and case loading
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchCase, resolveUri } from '../services/cqaiClient';

// Mock window.__ENV__
const mockEnv = {
  __ENV__: { API_BASE: '' }, // Dev mode
};

// Setup before each test
beforeEach(() => {
  // Reset window.__ENV__
  (window as any).__ENV__ = mockEnv.__ENV__;
  
  // Mock fetch globally
  global.fetch = vi.fn();
});

describe('cqaiClient - resolveUri', () => {
  it('should resolve image URIs correctly in dev mode', () => {
    (window as any).__ENV__ = { API_BASE: '' };
    
    expect(resolveUri('images/case2.png')).toBe('/images/case2.png');
    expect(resolveUri('/images/case2.png')).toBe('/images/case2.png');
    expect(resolveUri('images/test-image.png')).toBe('/images/test-image.png');
  });

  it('should handle full URLs', () => {
    expect(resolveUri('https://example.com/image.png')).toBe('https://example.com/image.png');
    expect(resolveUri('http://example.com/image.png')).toBe('http://example.com/image.png');
  });

  it('should prepend API_BASE in production mode', () => {
    (window as any).__ENV__ = { API_BASE: 'https://api.example.com' };
    
    expect(resolveUri('images/case2.png')).toBe('https://api.example.com/images/case2.png');
    expect(resolveUri('/images/case2.png')).toBe('https://api.example.com/images/case2.png');
  });
});

describe('cqaiClient - fetchCase', () => {
  it('should fetch case from public directory in dev mode', async () => {
    (window as any).__ENV__ = { API_BASE: '' };
    
    const mockCaseData = {
      case_id: 'DEMO-002',
      slides: [{
        slide_id: 'SLIDE-002',
        uri: 'images/case2.png',
      }],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCaseData,
    });

    const result = await fetchCase('DEMO-002');
    
    expect(global.fetch).toHaveBeenCalledWith('/mock/case-002.json', {
      cache: 'no-store',
    });
    expect(result).toEqual(mockCaseData);
  });

  it('should fetch case from API in production mode', async () => {
    (window as any).__ENV__ = { API_BASE: 'https://api.example.com' };
    
    const mockCaseData = {
      case_id: 'DEMO-001',
      slides: [{
        slide_id: 'SLIDE-001',
        uri: 'images/test-image.png',
      }],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCaseData,
    });

    const result = await fetchCase('DEMO-001');
    
    expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/cases/DEMO-001', {
      cache: 'no-store',
    });
    expect(result).toEqual(mockCaseData);
  });

  it('should handle case mapping correctly', async () => {
    (window as any).__ENV__ = { API_BASE: '' };
    
    const caseMappings = [
      { caseId: 'DEMO-001', expectedFile: 'case-demo.json' },
      { caseId: 'DEMO-002', expectedFile: 'case-002.json' },
      { caseId: 'DEMO-003', expectedFile: 'case-003.json' },
      { caseId: 'DEMO-004', expectedFile: 'case-004.json' },
    ];

    for (const { caseId, expectedFile } of caseMappings) {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ case_id: caseId }),
      });

      await fetchCase(caseId);
      
      expect(global.fetch).toHaveBeenCalledWith(`/mock/${expectedFile}`, {
        cache: 'no-store',
      });
    }
  });

  it('should throw error when case fetch fails', async () => {
    (window as any).__ENV__ = { API_BASE: '' };
    
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(fetchCase('DEMO-999')).rejects.toThrow('case fetch failed: 404');
  });
});

describe('Image Loading Integration', () => {
  it('should resolve image paths from case data correctly', () => {
    (window as any).__ENV__ = { API_BASE: '' };
    
    const caseData = {
      slides: [{
        uri: 'images/case2.png',
      }],
    };
    
    const resolvedUri = resolveUri(caseData.slides[0].uri);
    expect(resolvedUri).toBe('/images/case2.png');
  });

  it('should handle different image formats', () => {
    (window as any).__ENV__ = { API_BASE: '' };
    
    const formats = [
      'images/case2.png',
      'images/case3.png',
      'images/case4.png',
      'images/test-image.png',
    ];
    
    formats.forEach(uri => {
      const resolved = resolveUri(uri);
      expect(resolved).toBe(`/${uri}`);
      expect(resolved).toMatch(/^\/images\/.*\.png$/);
    });
  });
});

