/**
 * CoordinateTransformManager - Centralized coordinate transformation system
 * Handles browser zoom, device pixel ratio, and coordinate space conversions
 */

import { state } from './StateManager';
import { glCanvas } from './CanvasManager';

export type Transform = {
  scale: number;
  tx: number;
  ty: number;
};

class CoordinateTransformManager {
  private browserZoom: number = 1.0;
  private cachedZoom: number = 1.0;
  private zoomCheckElement: HTMLElement | null = null;

  /**
   * Detect browser zoom factor by comparing getBoundingClientRect() with computed styles
   * Uses multiple fallback methods for robustness
   */
  private detectBrowserZoom(element: HTMLElement): number {
    if (!element) return 1.0;

    try {
      const rect = element.getBoundingClientRect();
      const computed = window.getComputedStyle(element);
      
      const computedWidth = parseFloat(computed.width);
      const computedHeight = parseFloat(computed.height);

      // If dimensions are 0 or invalid, try fallback methods
      if (!computedWidth || !computedHeight || !rect.width || !rect.height) {
        // Fallback 1: Try using window.innerWidth/outerWidth ratio
        if (window.outerWidth && window.innerWidth) {
          const windowZoom = window.outerWidth / window.innerWidth;
          if (windowZoom > 0.5 && windowZoom < 5) {
            this.cachedZoom = windowZoom;
            return windowZoom;
          }
        }
        // Fallback 2: Use visualViewport if available
        if (window.visualViewport) {
          const vpZoom = window.visualViewport.scale || 1.0;
          if (vpZoom > 0.5 && vpZoom < 5) {
            this.cachedZoom = vpZoom;
            return vpZoom;
          }
        }
        // Fallback 3: Return cached zoom
        return this.cachedZoom;
      }

      // Calculate zoom factor by comparing actual vs computed dimensions
      const zoomX = rect.width / computedWidth;
      const zoomY = rect.height / computedHeight;
      const zoom = (zoomX + zoomY) / 2;

      // Validate zoom is reasonable (between 0.25x and 5x)
      if (zoom < 0.25 || zoom > 5 || !isFinite(zoom)) {
        console.warn('⚠️ Detected zoom value seems invalid:', zoom, 'using cached:', this.cachedZoom);
        return this.cachedZoom;
      }

      // Cache the zoom value
      this.cachedZoom = zoom;
      return zoom;
    } catch (e) {
      console.warn('⚠️ Failed to detect browser zoom:', e, 'using cached:', this.cachedZoom);
      return this.cachedZoom;
    }
  }

  /**
   * Get current browser zoom factor
   */
  getBrowserZoom(): number {
    if (!glCanvas) return 1.0;
    
    const element = glCanvas.parentElement || glCanvas;
    this.browserZoom = this.detectBrowserZoom(element);
    return this.browserZoom;
  }

  /**
   * Get zoom-compensated bounding client rect
   * Returns dimensions that account for browser zoom
   */
  getZoomAwareBoundingClientRect(element: HTMLElement): { left: number; top: number; width: number; height: number } {
    const rect = element.getBoundingClientRect();
    const zoom = this.getBrowserZoom();
    
    // Compensate for browser zoom
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width / zoom,
      height: rect.height / zoom
    };
  }

  /**
   * Convert screen/client coordinates to canvas logical coordinates
   * Accounts for browser zoom and element position
   */
  screenToCanvasLogical(clientX: number, clientY: number, element: HTMLElement): { x: number; y: number } {
    const zoomAwareRect = this.getZoomAwareBoundingClientRect(element);
    const zoom = this.getBrowserZoom(); // Ensure zoom is up to date
    
    return {
      x: (clientX - zoomAwareRect.left) / zoom,
      y: (clientY - zoomAwareRect.top) / zoom
    };
  }

  /**
   * Convert canvas logical coordinates to image coordinates
   */
  canvasLogicalToImage(canvasX: number, canvasY: number): { x: number; y: number } {
    const transform = this.getTransform();
    
    return {
      x: (canvasX - transform.tx) / transform.scale,
      y: (canvasY - transform.ty) / transform.scale
    };
  }

  /**
   * Convert image coordinates to canvas logical coordinates
   */
  imageToCanvasLogical(imageX: number, imageY: number): { x: number; y: number } {
    const transform = this.getTransform();
    
    return {
      x: imageX * transform.scale + transform.tx,
      y: imageY * transform.scale + transform.ty
    };
  }

  /**
   * Convert canvas logical coordinates to screen coordinates
   */
  canvasLogicalToScreen(canvasX: number, canvasY: number, element: HTMLElement): { x: number; y: number } {
    const zoomAwareRect = this.getZoomAwareBoundingClientRect(element);
    const zoom = this.getBrowserZoom(); // Ensure zoom is up to date
    
    return {
      x: canvasX * zoom + zoomAwareRect.left,
      y: canvasY * zoom + zoomAwareRect.top
    };
  }

  /**
   * Convert screen coordinates directly to image coordinates
   */
  screenToImage(clientX: number, clientY: number, element: HTMLElement): { x: number; y: number } {
    const canvasLogical = this.screenToCanvasLogical(clientX, clientY, element);
    return this.canvasLogicalToImage(canvasLogical.x, canvasLogical.y);
  }

  /**
   * Convert image coordinates directly to screen coordinates
   */
  imageToScreen(imageX: number, imageY: number, element: HTMLElement): { x: number; y: number } {
    const canvasLogical = this.imageToCanvasLogical(imageX, imageY);
    return this.canvasLogicalToScreen(canvasLogical.x, canvasLogical.y, element);
  }

  /**
   * Get current transform (from state)
   */
  getTransform(): Transform {
    return { ...state.transform };
  }

  /**
   * Recalculate transform based on current zoom level, pan values, and browser zoom
   * Optionally accepts explicit container dimensions to use instead of calculating them
   * This is the single source of truth for transform calculations
   */
  recalculateTransform(explicitWidth?: number, explicitHeight?: number): void {
    if (!state.currentImageDimensions || !state.currentImageDimensions.width) {
      console.warn('⚠️ recalculateTransform: image dimensions not set');
      return;
    }

    if (!glCanvas) {
      console.warn('⚠️ recalculateTransform: glCanvas not available');
      return;
    }

    // Get zoom-aware container size (with validation)
    // Use explicit dimensions if provided (for when we know the actual rendered size)
    let containerWidth: number;
    let containerHeight: number;
    
    if (explicitWidth !== undefined && explicitHeight !== undefined) {
      containerWidth = explicitWidth;
      containerHeight = explicitHeight;
    } else {
      const containerSize = this.getContainerSize();
      containerWidth = containerSize.width;
      containerHeight = containerSize.height;
    }

    if (containerWidth === 0 || containerHeight === 0) {
      console.warn('⚠️ recalculateTransform: container has zero size', {
        containerWidth,
        containerHeight,
        glCanvas: !!glCanvas,
        parentElement: !!glCanvas?.parentElement,
        usingExplicit: explicitWidth !== undefined
      });
      return;
    }

    const imageWidth = state.currentImageDimensions.width;
    const imageHeight = state.currentImageDimensions.height;

    // Validate image dimensions
    if (imageWidth <= 0 || imageHeight <= 0 || !isFinite(imageWidth) || !isFinite(imageHeight)) {
      console.warn('⚠️ recalculateTransform: invalid image dimensions', {
        imageWidth,
        imageHeight
      });
      return;
    }

    // Base scale (fit to window at zoom 1.0)
    const baseScale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);

    // Validate scale is reasonable
    if (!isFinite(baseScale) || baseScale <= 0) {
      console.warn('⚠️ recalculateTransform: invalid baseScale', {
        baseScale,
        containerWidth,
        containerHeight,
        imageWidth,
        imageHeight
      });
      return;
    }

    // Apply zoom multiplier
    const scale = baseScale * state.currentZoomLevel;

    // Calculate scaled dimensions
    const scaledWidth = imageWidth * scale;
    const scaledHeight = imageHeight * scale;

    // Start with base centering
    let tx = (containerWidth - scaledWidth) / 2;
    let ty = (containerHeight - scaledHeight) / 2;

    // Apply pan offsets (limited to prevent dragging too far)
    const maxPanX = Math.abs(scaledWidth - containerWidth) / 2;
    const maxPanY = Math.abs(scaledHeight - containerHeight) / 2;

    if (scaledWidth > containerWidth) {
      tx += Math.max(-maxPanX, Math.min(maxPanX, state.panX));
    }
    if (scaledHeight > containerHeight) {
      ty += Math.max(-maxPanY, Math.min(maxPanY, state.panY));
    }

    // Validate transform values are reasonable
    if (!isFinite(tx) || !isFinite(ty) || !isFinite(scale)) {
      console.error('❌ recalculateTransform: invalid transform values', {
        tx, ty, scale,
        containerWidth, containerHeight,
        imageWidth, imageHeight,
        scaledWidth, scaledHeight
      });
      return;
    }

    // Update transform in state
    state.transform.scale = scale;
    state.transform.tx = tx;
    state.transform.ty = ty;

    console.log('🔍 Transform recalculated:', {
      zoomLevel: state.currentZoomLevel,
      browserZoom: this.browserZoom,
      baseScale,
      finalScale: scale,
      pan: { panX: state.panX, panY: state.panY },
      transform: state.transform,
      containerSize: { width: containerWidth, height: containerHeight },
      imageSize: { width: imageWidth, height: imageHeight },
      scaledSize: { width: scaledWidth, height: scaledHeight }
    });
  }

  /**
   * Get zoom-aware container size
   * Validates and ensures reasonable values
   */
  getContainerSize(): { width: number; height: number } {
    if (!glCanvas) return { width: 0, height: 0 };
    
    const container = glCanvas.parentElement || glCanvas;
    if (!container) return { width: 0, height: 0 };
    
    const zoomAwareRect = this.getZoomAwareBoundingClientRect(container);
    
    // Validate dimensions are reasonable
    const width = Math.max(0, Math.round(zoomAwareRect.width));
    const height = Math.max(0, Math.round(zoomAwareRect.height));
    
    // If dimensions seem invalid, try direct measurement as fallback
    if (width === 0 || height === 0) {
      const directRect = container.getBoundingClientRect();
      const computed = window.getComputedStyle(container);
      const computedWidth = parseFloat(computed.width) || directRect.width;
      const computedHeight = parseFloat(computed.height) || directRect.height;
      
      if (computedWidth > 0 && computedHeight > 0) {
        return {
          width: Math.round(computedWidth),
          height: Math.round(computedHeight)
        };
      }
    }
    
    return { width, height };
  }
}

// Export singleton instance
export const coordinateTransform = new CoordinateTransformManager();

