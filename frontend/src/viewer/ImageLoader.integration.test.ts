/**
 * Integration tests for ImageLoader
 * Lightweight unit/integration tests with mocking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadImageFromUrl, loadImageFromFile } from './ImageLoader';
import { state } from './StateManager';

// Mock canvas elements
const mockCanvas = {
  width: 0,
  height: 0,
  style: {} as CSSStyleDeclaration,
  getContext: vi.fn(() => ({
    setTransform: vi.fn(),
    scale: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
  })),
  getBoundingClientRect: vi.fn(() => ({ width: 800, height: 600 })),
  parentElement: {
    getBoundingClientRect: vi.fn(() => ({ width: 800, height: 600 })),
  },
} as any;

beforeEach(() => {
  // Reset state
  state.reset();
  
  // Mock DOM elements with proper container size to avoid warnings
  document.getElementById = vi.fn((id: string) => {
    if (id === 'glCanvas' || id === 'overlayCanvas') {
      return mockCanvas;
    }
    if (id === 'dropZone') {
      return { style: { display: '' } } as any;
    }
    return null;
  });
  
  // Mock getCanvasContainerSize to return valid size to avoid warnings
  vi.mock('./CanvasManager', async () => {
    const actual = await vi.importActual('./CanvasManager');
    return {
      ...actual,
      getCanvasContainerSize: vi.fn(() => ({ width: 800, height: 600 })),
      updateCanvasSize: vi.fn(() => true),
      fitOverlayToImage: vi.fn(),
      renderImageCanvas: vi.fn(),
    };
  });
  
  vi.mock('./OverlayRenderer', () => ({
    renderOverlays: vi.fn(),
  }));
  
  // Mock Image constructor
  global.Image = class MockImage {
    width = 0;
    height = 0;
    src = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    
    constructor() {
      // Simulate image load after a short delay
      setTimeout(() => {
        this.width = 1920;
        this.height = 1080;
        if (this.onload) {
          this.onload();
        }
      }, 0);
    }
  } as any;
});

describe('ImageLoader - loadImageFromUrl', () => {
  it('should load PNG image successfully', async () => {
    const statusUpdates: string[] = [];
    const spinnerUpdates: boolean[] = [];
    
    const onStatusUpdate = (status: string) => statusUpdates.push(status);
    const onSpinnerUpdate = (show: boolean) => spinnerUpdates.push(show);
    
    const mockNv = {
      loadImages: vi.fn(),
    };
    
    const img = await loadImageFromUrl(
      '/images/test.png',
      mockNv,
      onStatusUpdate,
      onSpinnerUpdate
    );
    
    expect(img).not.toBeNull();
    expect(state.currentImageDimensions.width).toBe(1920);
    expect(state.currentImageDimensions.height).toBe(1080);
    expect(state.currentImageObject).toBe(img);
    expect(spinnerUpdates).toContain(false); // Spinner should be hidden
  });

  it('should handle image load errors', async () => {
    const statusUpdates: string[] = [];
    const spinnerUpdates: boolean[] = [];
    
    const onStatusUpdate = (status: string) => statusUpdates.push(status);
    const onSpinnerUpdate = (show: boolean) => spinnerUpdates.push(show);
    
    // Create an image that will fail to load
    const originalImage = global.Image;
    global.Image = class MockImage {
      width = 0;
      height = 0;
      src = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      
      constructor() {
        setTimeout(() => {
          if (this.onerror) {
            this.onerror();
          }
        }, 0);
      }
    } as any;
    
    const mockNv = {
      loadImages: vi.fn(),
    };
    
    await expect(
      loadImageFromUrl('/images/invalid.png', mockNv, onStatusUpdate, onSpinnerUpdate)
    ).rejects.toThrow('Image load failed');
    
    expect(statusUpdates).toContain('error loading image');
    expect(spinnerUpdates).toContain(false);
    
    // Restore original Image
    global.Image = originalImage;
  });

  it('should handle non-PNG images with Niivue', async () => {
    const mockNv = {
      loadImages: vi.fn().mockResolvedValue(undefined),
    };
    
    const statusUpdates: string[] = [];
    const spinnerUpdates: boolean[] = [];
    
    const onStatusUpdate = (status: string) => statusUpdates.push(status);
    const onSpinnerUpdate = (show: boolean) => spinnerUpdates.push(show);
    
    const img = await loadImageFromUrl(
      '/images/test.nii.gz',
      mockNv,
      onStatusUpdate,
      onSpinnerUpdate
    );
    
    expect(mockNv.loadImages).toHaveBeenCalled();
    expect(statusUpdates).toContain('ready');
  });
});

describe('ImageLoader - loadImageFromFile', () => {
  it('should load image from File object', async () => {
    const statusUpdates: string[] = [];
    const spinnerUpdates: boolean[] = [];
    
    const onStatusUpdate = (status: string) => statusUpdates.push(status);
    const onSpinnerUpdate = (show: boolean) => spinnerUpdates.push(show);
    
    // Create a mock File
    const mockFile = new File([''], 'test.png', { type: 'image/png' });
    
    // Mock FileReader as a proper constructor
    class MockFileReader {
      readAsDataURL = vi.fn(function(this: MockFileReader) {
        setTimeout(() => {
          this.result = 'data:image/png;base64,test';
          if (this.onload) {
            this.onload({ target: { result: this.result } } as any);
          }
        }, 0);
      });
      onload: ((e: any) => void) | null = null;
      onerror: (() => void) | null = null;
      result = '';
    }
    
    global.FileReader = MockFileReader as any;
    
    const img = await loadImageFromFile(mockFile, onStatusUpdate, onSpinnerUpdate);
    
    expect(img).not.toBeNull();
    expect(state.currentImageFile).toBe(mockFile);
    expect(state.currentImageDimensions.width).toBe(1920);
    expect(state.currentImageDimensions.height).toBe(1080);
    expect(statusUpdates).toContain('ready');
  });

  it('should handle file read errors', async () => {
    const statusUpdates: string[] = [];
    const spinnerUpdates: boolean[] = [];
    
    const onStatusUpdate = (status: string) => statusUpdates.push(status);
    const onSpinnerUpdate = (show: boolean) => spinnerUpdates.push(show);
    
    const mockFile = new File([''], 'test.png', { type: 'image/png' });
    
    // Mock FileReader that will error
    class MockFileReader {
      readAsDataURL = vi.fn(function(this: MockFileReader) {
        setTimeout(() => {
          if (this.onerror) {
            this.onerror();
          }
        }, 0);
      });
      onload: ((e: any) => void) | null = null;
      onerror: (() => void) | null = null;
      result = '';
    }
    
    global.FileReader = MockFileReader as any;
    
    await expect(
      loadImageFromFile(mockFile, onStatusUpdate, onSpinnerUpdate)
    ).rejects.toThrow('File read failed');
    
    expect(statusUpdates).toContain('error reading file');
  });
});

