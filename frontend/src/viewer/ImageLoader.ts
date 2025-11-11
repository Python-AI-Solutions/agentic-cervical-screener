/**
 * ImageLoader - Handles image loading from URLs and files
 */

import { Niivue } from '@niivue/niivue';
import { state } from './StateManager';
import { fitOverlayToImage, renderImageCanvas, updateCanvasSize } from './CanvasManager';
import { renderOverlays } from './OverlayRenderer';

/**
 * Load image from URL (for case loading)
 */
export async function loadImageFromUrl(
  imgUrl: string,
  nv: any,
  onStatusUpdate: (status: string) => void,
  onSpinnerUpdate: (show: boolean) => void
): Promise<HTMLImageElement | null> {
  if (/\.(png|jpg|jpeg)$/i.test(imgUrl)) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          state.currentImageDimensions = { width: img.width, height: img.height };
          state.currentImageObject = img;
          
          // Fit overlay and render
          updateCanvasSize();
          fitOverlayToImage(img.width, img.height);
          renderImageCanvas();
          renderOverlays();
          
          onStatusUpdate('ready');
          onSpinnerUpdate(false);
          resolve(img);
        } catch (e) {
          console.error('Error rendering image:', e);
          reject(e);
        }
      };
      img.onerror = () => {
        console.error('Failed to load image:', imgUrl);
        onStatusUpdate('error loading image');
        onSpinnerUpdate(false);
        reject(new Error('Image load failed'));
      };
      img.src = imgUrl;
    });
  } else {
    try {
      await nv.loadImages([{ url: imgUrl, name: 'slide', colormap: 'gray', opacity: 1 }]);
      const img = new Image();
      img.onload = () => {
        state.currentImageDimensions = { width: img.width, height: img.height };
        state.currentImageObject = img;
        updateCanvasSize();
        fitOverlayToImage(img.width, img.height);
        renderImageCanvas();
        renderOverlays();
      };
      img.src = imgUrl;
      onStatusUpdate('ready');
      onSpinnerUpdate(false);
      return img;
    } catch (error) {
      console.warn('unsupported image format for demo:', imgUrl, error);
      updateCanvasSize();
      fitOverlayToImage(1024, 1024);
      renderOverlays();
      onStatusUpdate('ready');
      onSpinnerUpdate(false);
      return null;
    }
  }
}

/**
 * Load image from File object (for file upload)
 */
export async function loadImageFromFile(
  file: File,
  onStatusUpdate: (status: string) => void,
  onSpinnerUpdate: (show: boolean) => void
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          state.currentImageDimensions = { width: img.width, height: img.height };
          state.currentImageObject = img;
          state.currentImageFile = file;
          
          // Fit overlay and render
          updateCanvasSize();
          fitOverlayToImage(img.width, img.height);
          renderImageCanvas();
          renderOverlays();
          
          // Hide drop zone
          const dropZone = document.getElementById('dropZone');
          if (dropZone) {
            dropZone.style.display = 'none';
          }
          
          onStatusUpdate('ready');
          onSpinnerUpdate(false);
          resolve(img);
        } catch (e) {
          console.error('Error rendering image:', e);
          reject(e);
        }
      };
      img.onerror = () => {
        console.error('Failed to load image from file');
        onStatusUpdate('error loading image');
        onSpinnerUpdate(false);
        reject(new Error('Image load failed'));
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      onStatusUpdate('error reading file');
      onSpinnerUpdate(false);
      reject(new Error('File read failed'));
    };
    reader.readAsDataURL(file);
  });
}

