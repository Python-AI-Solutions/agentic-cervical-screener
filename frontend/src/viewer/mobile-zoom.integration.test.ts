/**
 * Integration tests for mobile viewport and browser zoom
 * Ensures images display correctly at different zoom levels on mobile devices
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state } from './StateManager';
import { coordinateTransform } from './CoordinateTransformManager';
import { getCanvasContainerSize, fitOverlayToImage, renderImageCanvas, glCanvas, overlayCanvas } from './CanvasManager';
import { renderOverlays } from './OverlayRenderer';

// Mock CanvasManager with mobile viewport
vi.mock('./CanvasManager', async () => {
  const actual = await vi.importActual('./CanvasManager');
  
  // Create mock canvas inline to avoid hoisting issues
  const createMobileMockCanvas = (viewportWidth: number, viewportHeight: number, browserZoom: number = 1.0) => {
    const logicalWidth = viewportWidth;
    const logicalHeight = viewportHeight;
    const zoomedWidth = viewportWidth * browserZoom;
    const zoomedHeight = viewportHeight * browserZoom;
    
    return {
      parentElement: {
        getBoundingClientRect: vi.fn(() => ({
          width: zoomedWidth,
          height: zoomedHeight,
          left: 0,
          top: 56, // Header height
        })),
        style: {
          width: `${logicalWidth}px`,
          height: `${logicalHeight}px`,
        },
      },
      getBoundingClientRect: vi.fn(() => ({
        width: zoomedWidth,
        height: zoomedHeight,
        left: 0,
        top: 56,
      })),
      style: {
        width: `${logicalWidth}px`,
        height: `${logicalHeight}px`,
      },
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({
        setTransform: vi.fn(),
        scale: vi.fn(),
        clearRect: vi.fn(),
        drawImage: vi.fn(),
        strokeRect: vi.fn(),
        fillRect: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn(() => ({ width: 100 })),
        save: vi.fn(),
        restore: vi.fn(),
      })),
    };
  };
  
  const mockCanvas = createMobileMockCanvas(375, 667, 1.0);
  
  return {
    ...actual,
    glCanvas: mockCanvas as any,
    overlayCanvas: mockCanvas as any,
  };
});

// Mock OverlayRenderer
vi.mock('./OverlayRenderer', () => ({
  renderOverlays: vi.fn(),
}));

// Mock window.getComputedStyle
const mockGetComputedStyle = vi.fn();

beforeEach(() => {
  state.reset();
  state.currentImageDimensions = { width: 1920, height: 1080 };
  state.currentImageObject = {
    width: 1920,
    height: 1080,
    src: 'test-image.png',
  } as HTMLImageElement;
  
  vi.clearAllMocks();
  global.getComputedStyle = mockGetComputedStyle;
  Object.defineProperty(window, 'devicePixelRatio', {
    writable: true,
    value: 2, // Typical mobile DPR
  });
  
  // Reset to default mobile viewport
  const updateMockCanvas = (canvas: any, width: number, height: number, zoom: number) => {
    const zoomedWidth = width * zoom;
    const zoomedHeight = height * zoom;
    canvas.parentElement.getBoundingClientRect.mockReturnValue({
      width: zoomedWidth,
      height: zoomedHeight,
      left: 0,
      top: 56,
    });
    canvas.getBoundingClientRect.mockReturnValue({
      width: zoomedWidth,
      height: zoomedHeight,
      left: 0,
      top: 56,
    });
    canvas.parentElement.style.width = `${width}px`;
    canvas.parentElement.style.height = `${height}px`;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  };
  
  if (glCanvas && overlayCanvas) {
    updateMockCanvas(glCanvas, 375, 667, 1.0);
    updateMockCanvas(overlayCanvas, 375, 667, 1.0);
  }
  
  mockGetComputedStyle.mockReturnValue({
    width: '375px',
    height: '667px',
  } as CSSStyleDeclaration);
});

describe('Mobile Viewport - Image Display', () => {
  const mobileViewports = [
    { name: 'iPhone SE', width: 375, height: 667 },
    { name: 'iPhone 12/13', width: 390, height: 844 },
    { name: 'iPhone 14 Pro Max', width: 430, height: 932 },
    { name: 'iPad Mini', width: 768, height: 1024 },
  ];

  mobileViewports.forEach(({ name, width, height }) => {
    describe(`${name} (${width}x${height})`, () => {
      beforeEach(() => {
        const updateMockCanvas = (canvas: any, w: number, h: number, zoom: number) => {
          const zoomedWidth = w * zoom;
          const zoomedHeight = h * zoom;
          canvas.parentElement.getBoundingClientRect.mockReturnValue({
            width: zoomedWidth,
            height: zoomedHeight,
            left: 0,
            top: 56,
          });
          canvas.getBoundingClientRect.mockReturnValue({
            width: zoomedWidth,
            height: zoomedHeight,
            left: 0,
            top: 56,
          });
          canvas.parentElement.style.width = `${w}px`;
          canvas.parentElement.style.height = `${h}px`;
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;
        };
        
        if (glCanvas && overlayCanvas) {
          updateMockCanvas(glCanvas, width, height, 1.0);
          updateMockCanvas(overlayCanvas, width, height, 1.0);
        }
        
        mockGetComputedStyle.mockReturnValue({
          width: `${width}px`,
          height: `${height}px`,
        } as CSSStyleDeclaration);
      });

      it('should calculate correct container size', () => {
        const size = getCanvasContainerSize();
        
        expect(size.width).toBeGreaterThan(0);
        expect(size.height).toBeGreaterThan(0);
        expect(size.width).toBeLessThanOrEqual(width);
        expect(size.height).toBeLessThanOrEqual(height);
      });

      it('should center image in viewport', () => {
        fitOverlayToImage(1920, 1080);
        
        const transform = coordinateTransform.getTransform();
        const containerSize = getCanvasContainerSize();
        
        // Image should be scaled to fit
        const expectedScale = Math.min(
          containerSize.width / 1920,
          containerSize.height / 1080
        );
        
        expect(transform.scale).toBeCloseTo(expectedScale, 2);
        
        // Image should be centered (tx and ty should position image in center)
        const scaledWidth = 1920 * transform.scale;
        const scaledHeight = 1080 * transform.scale;
        const expectedTx = (containerSize.width - scaledWidth) / 2;
        const expectedTy = (containerSize.height - scaledHeight) / 2;
        
        expect(transform.tx).toBeCloseTo(expectedTx, 1);
        expect(transform.ty).toBeCloseTo(expectedTy, 1);
      });

      it('should render image at correct position', () => {
        fitOverlayToImage(1920, 1080);
        renderImageCanvas();
        
        const transform = coordinateTransform.getTransform();
        const containerSize = getCanvasContainerSize();
        
        // Verify image is centered
        const scaledWidth = 1920 * transform.scale;
        const scaledHeight = 1080 * transform.scale;
        
        // Image should be visible and centered
        expect(transform.tx).toBeGreaterThanOrEqual(0);
        expect(transform.ty).toBeGreaterThanOrEqual(0);
        expect(transform.tx + scaledWidth).toBeLessThanOrEqual(containerSize.width);
        expect(transform.ty + scaledHeight).toBeLessThanOrEqual(containerSize.height);
        
        // Image should not be positioned in bottom-right corner
        // (which would indicate a bug)
        const imageRight = transform.tx + scaledWidth;
        const imageBottom = transform.ty + scaledHeight;
        const containerRight = containerSize.width;
        const containerBottom = containerSize.height;
        
        // Image should be reasonably centered (not stuck to bottom-right)
        const centerX = containerSize.width / 2;
        const centerY = containerSize.height / 2;
        const imageCenterX = transform.tx + scaledWidth / 2;
        const imageCenterY = transform.ty + scaledHeight / 2;
        
        // Image center should be close to container center (within 20% tolerance)
        expect(Math.abs(imageCenterX - centerX)).toBeLessThan(containerSize.width * 0.2);
        expect(Math.abs(imageCenterY - centerY)).toBeLessThan(containerSize.height * 0.2);
      });
    });
  });
});

describe('Mobile Browser Zoom Levels', () => {
  const zoomLevels = [
    { name: '50% zoom', zoom: 0.5 },
    { name: '100% zoom (normal)', zoom: 1.0 },
    { name: '150% zoom', zoom: 1.5 },
    { name: '200% zoom', zoom: 2.0 },
  ];

  zoomLevels.forEach(({ name, zoom }) => {
    describe(`${name}`, () => {
      beforeEach(() => {
        const updateMockCanvas = (canvas: any, w: number, h: number, z: number) => {
          const zoomedWidth = w * z;
          const zoomedHeight = h * z;
          canvas.parentElement.getBoundingClientRect.mockReturnValue({
            width: zoomedWidth,
            height: zoomedHeight,
            left: 0,
            top: 56,
          });
          canvas.getBoundingClientRect.mockReturnValue({
            width: zoomedWidth,
            height: zoomedHeight,
            left: 0,
            top: 56,
          });
          canvas.parentElement.style.width = `${w}px`;
          canvas.parentElement.style.height = `${h}px`;
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;
        };
        
        if (glCanvas && overlayCanvas) {
          updateMockCanvas(glCanvas, 375, 667, zoom);
          updateMockCanvas(overlayCanvas, 375, 667, zoom);
        }
        
        mockGetComputedStyle.mockReturnValue({
          width: '375px',
          height: '667px',
        } as CSSStyleDeclaration);
      });

      it('should detect browser zoom correctly', () => {
        const detectedZoom = coordinateTransform.getBrowserZoom();
        expect(detectedZoom).toBeCloseTo(zoom, 0.1);
      });

      it('should calculate zoom-aware container size', () => {
        const size = getCanvasContainerSize();
        
        // Container size should be zoom-compensated (logical size, not zoomed)
        expect(size.width).toBeCloseTo(375, 10);
        expect(size.height).toBeCloseTo(667, 10);
      });

      it('should center image correctly at zoom level', () => {
        fitOverlayToImage(1920, 1080);
        
        const transform = coordinateTransform.getTransform();
        const containerSize = getCanvasContainerSize();
        
        // Image should be scaled to fit the zoom-compensated container
        const expectedScale = Math.min(
          containerSize.width / 1920,
          containerSize.height / 1080
        );
        
        expect(transform.scale).toBeCloseTo(expectedScale, 2);
        
        // Image should be centered
        const scaledWidth = 1920 * transform.scale;
        const scaledHeight = 1080 * transform.scale;
        const expectedTx = (containerSize.width - scaledWidth) / 2;
        const expectedTy = (containerSize.height - scaledHeight) / 2;
        
        expect(transform.tx).toBeCloseTo(expectedTx, 1);
        expect(transform.ty).toBeCloseTo(expectedTy, 1);
      });

      it('should render image at correct position regardless of zoom', () => {
        fitOverlayToImage(1920, 1080);
        renderImageCanvas();
        
        const transform = coordinateTransform.getTransform();
        const containerSize = getCanvasContainerSize();
        
        // Verify image is centered, not in bottom-right corner
        const scaledWidth = 1920 * transform.scale;
        const scaledHeight = 1080 * transform.scale;
        const imageCenterX = transform.tx + scaledWidth / 2;
        const imageCenterY = transform.ty + scaledHeight / 2;
        const containerCenterX = containerSize.width / 2;
        const containerCenterY = containerSize.height / 2;
        
        // Image center should be close to container center
        expect(Math.abs(imageCenterX - containerCenterX)).toBeLessThan(containerSize.width * 0.2);
        expect(Math.abs(imageCenterY - containerCenterY)).toBeLessThan(containerSize.height * 0.2);
      });

      it('should handle zoom changes dynamically', () => {
        // Initial zoom
        fitOverlayToImage(1920, 1080);
        const initialTransform = { ...coordinateTransform.getTransform() };
        
        // Change zoom level
        const newZoom = zoom === 1.0 ? 1.5 : 1.0;
        const updateMockCanvas = (canvas: any, w: number, h: number, z: number) => {
          const zoomedWidth = w * z;
          const zoomedHeight = h * z;
          canvas.parentElement.getBoundingClientRect.mockReturnValue({
            width: zoomedWidth,
            height: zoomedHeight,
            left: 0,
            top: 56,
          });
          canvas.getBoundingClientRect.mockReturnValue({
            width: zoomedWidth,
            height: zoomedHeight,
            left: 0,
            top: 56,
          });
        };
        
        if (glCanvas && overlayCanvas) {
          updateMockCanvas(glCanvas, 375, 667, newZoom);
          updateMockCanvas(overlayCanvas, 375, 667, newZoom);
        }
        
        // Recalculate transform
        coordinateTransform.recalculateTransform();
        const newTransform = coordinateTransform.getTransform();
        
        // Transform should be recalculated
        expect(newTransform.scale).toBeDefined();
        expect(newTransform.tx).toBeDefined();
        expect(newTransform.ty).toBeDefined();
        
        // Image should still be centered
        const containerSize = getCanvasContainerSize();
        const scaledWidth = 1920 * newTransform.scale;
        const scaledHeight = 1080 * newTransform.scale;
        const imageCenterX = newTransform.tx + scaledWidth / 2;
        const imageCenterY = newTransform.ty + scaledHeight / 2;
        const containerCenterX = containerSize.width / 2;
        const containerCenterY = containerSize.height / 2;
        
        expect(Math.abs(imageCenterX - containerCenterX)).toBeLessThan(containerSize.width * 0.2);
        expect(Math.abs(imageCenterY - containerCenterY)).toBeLessThan(containerSize.height * 0.2);
      });
    });
  });
});

describe('Mobile Image Positioning - Edge Cases', () => {
  beforeEach(() => {
    const updateMockCanvas = (canvas: any, w: number, h: number, z: number) => {
      const zoomedWidth = w * z;
      const zoomedHeight = h * z;
      canvas.parentElement.getBoundingClientRect.mockReturnValue({
        width: zoomedWidth,
        height: zoomedHeight,
        left: 0,
        top: 56,
      });
      canvas.getBoundingClientRect.mockReturnValue({
        width: zoomedWidth,
        height: zoomedHeight,
        left: 0,
        top: 56,
      });
      canvas.parentElement.style.width = `${w}px`;
      canvas.parentElement.style.height = `${h}px`;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    
    if (glCanvas && overlayCanvas) {
      updateMockCanvas(glCanvas, 375, 667, 1.0);
      updateMockCanvas(overlayCanvas, 375, 667, 1.0);
    }
    
    mockGetComputedStyle.mockReturnValue({
      width: '375px',
      height: '667px',
    } as CSSStyleDeclaration);
  });

  it('should handle portrait image on mobile', () => {
    state.currentImageDimensions = { width: 1080, height: 1920 }; // Portrait
    
    fitOverlayToImage(1080, 1920);
    
    const transform = coordinateTransform.getTransform();
    const containerSize = getCanvasContainerSize();
    
    // Portrait image should fit height
    const expectedScale = Math.min(
      containerSize.width / 1080,
      containerSize.height / 1920
    );
    
    expect(transform.scale).toBeCloseTo(expectedScale, 2);
    
    // Should be centered
    const scaledWidth = 1080 * transform.scale;
    const scaledHeight = 1920 * transform.scale;
    const imageCenterX = transform.tx + scaledWidth / 2;
    const imageCenterY = transform.ty + scaledHeight / 2;
    const containerCenterX = containerSize.width / 2;
    const containerCenterY = containerSize.height / 2;
    
    expect(Math.abs(imageCenterX - containerCenterX)).toBeLessThan(containerSize.width * 0.2);
    expect(Math.abs(imageCenterY - containerCenterY)).toBeLessThan(containerSize.height * 0.2);
  });

  it('should handle very large image on mobile', () => {
    state.currentImageDimensions = { width: 4000, height: 3000 }; // Very large
    
    fitOverlayToImage(4000, 3000);
    
    const transform = coordinateTransform.getTransform();
    const containerSize = getCanvasContainerSize();
    
    // Should scale down to fit
    expect(transform.scale).toBeLessThan(1);
    
    // Should be centered
    const scaledWidth = 4000 * transform.scale;
    const scaledHeight = 3000 * transform.scale;
    const imageCenterX = transform.tx + scaledWidth / 2;
    const imageCenterY = transform.ty + scaledHeight / 2;
    const containerCenterX = containerSize.width / 2;
    const containerCenterY = containerSize.height / 2;
    
    expect(Math.abs(imageCenterX - containerCenterX)).toBeLessThan(containerSize.width * 0.2);
    expect(Math.abs(imageCenterY - containerCenterY)).toBeLessThan(containerSize.height * 0.2);
  });

  it('should handle very small image on mobile', () => {
    state.currentImageDimensions = { width: 200, height: 200 }; // Very small
    
    fitOverlayToImage(200, 200);
    
    const transform = coordinateTransform.getTransform();
    const containerSize = getCanvasContainerSize();
    
    // Should scale up to fit
    expect(transform.scale).toBeGreaterThan(1);
    
    // Should be centered
    const scaledWidth = 200 * transform.scale;
    const scaledHeight = 200 * transform.scale;
    const imageCenterX = transform.tx + scaledWidth / 2;
    const imageCenterY = transform.ty + scaledHeight / 2;
    const containerCenterX = containerSize.width / 2;
    const containerCenterY = containerSize.height / 2;
    
    expect(Math.abs(imageCenterX - containerCenterX)).toBeLessThan(containerSize.width * 0.2);
    expect(Math.abs(imageCenterY - containerCenterY)).toBeLessThan(containerSize.height * 0.2);
  });
});

