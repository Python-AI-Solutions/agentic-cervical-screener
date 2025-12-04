/**
 * Main viewer orchestrator - Coordinates all viewer modules
 */

// @ts-nocheck
import { Niivue } from '@niivue/niivue';
import { fetchCase, resolveUri } from '../services/cqaiClient';
import { classify } from '../services/classifyClient';
import { addLayerToNiivue } from './overlayAdapters';
import { collectRois } from './roiNav';

// Import modules
import { state } from './StateManager';
import { 
  glCanvas, 
  overlayCanvas, 
  overlayCtx,
  getCanvasContainerSize,
  updateCanvasSize,
  fitOverlayToImage,
  renderImageCanvas,
  handleCanvasResize,
  debouncedResize
} from './CanvasManager';
import { renderOverlays } from './OverlayRenderer';
import { setupDrawingMode } from './DrawingManager';
import { setupZoomHandlers, recalculateTransform } from './ZoomPanManager';
import { loadImageFromUrl, loadImageFromFile } from './ImageLoader';
import { coordinateTransform } from './CoordinateTransformManager';

// DOM elements
const statusEl = document.getElementById('status');
const spinnerEl = document.getElementById('spinner');
const layersEl = document.getElementById('layers');
const mobileLayersEl = document.getElementById('mobileLayers');
const btnClassify = document.getElementById('btnClassify');
const btnDownload = document.getElementById('btnDownload');
const btnClearRois = document.getElementById('btnClearRois');
const imageFileInput = document.getElementById('imageFile') as HTMLInputElement;
const btnLoadImage = document.getElementById('btnLoadImage');

// UI helpers
function setStatus(s: string) { 
  if (statusEl) statusEl.textContent = s; 
}

function showSpinner(v: boolean) {
  if (spinnerEl) {
    spinnerEl.hidden = !v;
  }
}

// Layer toggle management
function addLayerToggle(layerId: string, geometry: string, checked = true) {
  // Check if layer toggle already exists
  if (document.querySelector(`[data-layer="${layerId}"]`)) return;

  // Create layer toggle for desktop
  if (layersEl) {
    const el = document.createElement('div');
    el.className = 'layer';
    el.innerHTML = `
      <span>${layerId} <span class="muted">(${geometry})</span></span>
      <label class="toggle-switch">
        <input type="checkbox" data-layer="${layerId}" ${checked ? 'checked' : ''}/>
        <span class="toggle-slider"></span>
      </label>`;
    layersEl.appendChild(el);
  }

  // Create layer toggle for mobile
  if (mobileLayersEl) {
    const mobileEl = document.createElement('div');
    mobileEl.className = 'layer';
    mobileEl.innerHTML = `
      <span>${layerId} <span class="muted">(${geometry})</span></span>
      <label class="toggle-switch">
        <input type="checkbox" data-layer="${layerId}" ${checked ? 'checked' : ''}/>
        <span class="toggle-slider"></span>
      </label>`;
    mobileLayersEl.appendChild(mobileEl);
  }

  // Add event listeners to both
  const checkboxes = document.querySelectorAll(`[data-layer="${layerId}"]`);
  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      // Sync all checkboxes with the same data-layer
      checkboxes.forEach((checkbox: HTMLInputElement) => checkbox.checked = (cb as HTMLInputElement).checked);

      // Handle specific layer behaviors
      if (layerId === 'ai-detections') {
        state.showAIDetections = (cb as HTMLInputElement).checked;
      } else if (layerId === 'user-drawn-rois') {
        state.showUserDrawnRois = (cb as HTMLInputElement).checked;
      } else {
        // Handle regular layers
        (cb as HTMLInputElement).checked ? state.visibleLayers.add(layerId) : state.visibleLayers.delete(layerId);
      }

      renderOverlays();
    });
  });
}

function addAIDetectionsToggle() {
  addLayerToggle('ai-detections', 'rects', true);
}

function addUserDrawnRoisToggle() {
  addLayerToggle('user-drawn-rois', 'rects', true);
}

// Redraw current image helper
function redrawCurrentImage({ ensureSize = false, reason = 'resize' } = {}) {
  if (!state.currentImageObject) {
    return false;
  }

  if (ensureSize) {
    updateCanvasSize();
  }

  const { width, height } = state.currentImageDimensions || {};
  if (width && height) {
    fitOverlayToImage(width, height);
  }

  renderImageCanvas();
  renderOverlays();

  console.log('♻️ Image redraw complete:', {
    reason,
    containerSize: getCanvasContainerSize(),
    imageSize: state.currentImageDimensions
  });

  return true;
}

// Main case loading function
async function loadCaseFromUrl(url?: string) {
  setStatus('loading…');
  showSpinner(true);
  
  if (layersEl) layersEl.innerHTML = '';
  if (mobileLayersEl) mobileLayersEl.innerHTML = '';
  
  if (overlayCanvas && overlayCtx) {
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  }
  
  // Reset state
  state.reset();

  // Show drop zone when loading new case
  const dropZone = document.getElementById('dropZone');
  if (dropZone) {
    dropZone.style.display = 'block';
  }

  // Initialize Niivue
  const NvCtor = Niivue;
  window.Niivue = Niivue;
  window.niivue = { Niivue };
  if (!NvCtor) throw new Error('Niivue not loaded');
  
  state.nv = new NvCtor({ isResizeCanvas: true });
  await state.nv.attachTo('glCanvas');

  // Load case data
  let doc = null;
  if (url) {
    // Check cache first
    if (state.caseCache.has(url)) {
      doc = state.caseCache.get(url);
      console.log('Using cached case data for:', url);
    } else {
      // Extract case ID from URL (e.g., '/cases/DEMO-001' -> 'DEMO-001')
      const caseIdMatch = url.match(/\/cases\/([^\/]+)$/);
      const caseId = caseIdMatch ? caseIdMatch[1] : null;
      
      if (caseId) {
        // Use fetchCase which handles dev/prod mode correctly
        doc = await fetchCase(caseId);
        state.caseCache.set(url, doc);
        console.log('Cached case data for:', url);
      } else {
        // Fallback to direct fetch (for backward compatibility)
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error('case json fetch failed');
        doc = await r.json();
        state.caseCache.set(url, doc);
      }
    }
  } else {
    doc = await fetchCase();
  }
  
  state.lastLoadedCase = doc;
  const slide = doc.slides?.[0];
  if (!slide) throw new Error('no slides');
  
  state.currentSlideId = slide.slide_id || 'SLIDE-001';
  state.currentSlideUri = slide.uri;
  const imgUrl = resolveUri(slide.uri);

  // Load image asynchronously
  loadImageFromUrl(imgUrl, state.nv, setStatus, showSpinner).catch(console.error);

  // Add user-drawn ROIs toggle
  addUserDrawnRoisToggle();

  // Build layer controls + prefetch & cache asynchronously
  const layerPromises = (slide.layers || []).map(async (L: any) => {
    // UI - create immediately for better UX
    state.visibleLayers.add(L.layer_id);
    addLayerToggle(L.layer_id, L.geometry, true);

    // Cache data asynchronously (non-blocking)
    try {
      const fc = await addLayerToNiivue(state.nv, L, resolveUri, overlayCtx, state.transform);
      if (fc) {
        state.layerCache.set(L.layer_id, { fc, colorKind: L.kind });
        // ROIs: collect from rect-like layers
        if (L.geometry === 'rects' || L.kind === 'roi') {
          try {
            state.rois.push(...collectRois(fc));
          } catch (e) {
            console.warn('Failed to collect ROIs:', e);
          }
        }
      }
    } catch (e) {
      console.warn('layer load failed', L.layer_id, e);
    }
  });

  // Process layers in background
  Promise.allSettled(layerPromises).then(() => {
    console.log('All layers processed');
  });
}

// Make loadCaseFromUrl available globally
window.loadCaseFromUrl = loadCaseFromUrl;

// Drag and drop functionality
function setupDragAndDrop() {
  const viewer = document.getElementById('viewer');
  if (!viewer) return;

  function preventDefaults(e: Event) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    viewer.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  function highlight(e: DragEvent) {
    viewer.classList.add('drag-over');
  }

  function unhighlight(e: DragEvent) {
    viewer.classList.remove('drag-over');
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    viewer.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    viewer.addEventListener(eventName, unhighlight, false);
  });

  viewer.addEventListener('drop', async (e: DragEvent) => {
    const dt = e.dataTransfer;
    const files = dt?.files;
    if (files && files.length > 0) {
      await handleDroppedFiles(files);
    }
  });
}

async function handleDroppedFiles(files: FileList) {
  const imageFiles = Array.from(files).filter(file => 
    file.type.startsWith('image/') || /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(file.name)
  );

  if (imageFiles.length === 0) {
    setStatus('No image files found');
    return;
  }

  const file = imageFiles[0];
  setStatus('loading image…');
  showSpinner(true);

  try {
    await loadImageFromFile(file, setStatus, showSpinner);
    setStatus('ready');
  } catch (error) {
    console.error('Error loading image:', error);
    setStatus('error loading image');
  } finally {
    showSpinner(false);
  }
}

// Image file loading
if (btnLoadImage) {
  btnLoadImage.addEventListener('click', () => {
    imageFileInput?.click();
  });
}

if (imageFileInput) {
  imageFileInput.addEventListener('change', async (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      await handleDroppedFiles(files);
    }
    // Reset the input
    (e.target as HTMLInputElement).value = '';
  });
}

// Classification button
if (btnClassify) {
  btnClassify.addEventListener('click', async () => {
    try {
      setStatus('classifying…');
      showSpinner(true);
      btnClassify.disabled = true;

      const res = await classify(state.currentSlideId, state.currentSlideUri, state.currentImageFile);
      state.lastBoxes = res.boxes || [];

      // Add AI detections toggle if it doesn't exist
      addAIDetectionsToggle();

      if (overlayCanvas) {
        overlayCanvas.style.cursor = 'crosshair';
      }

      renderOverlays();
      setStatus(`classified - ${state.lastBoxes.length} detections found`);
    } catch (e: any) {
      console.error('❌ Classification error:', e);
      setStatus('classification failed: ' + e.message);
    } finally {
      showSpinner(false);
      btnClassify.disabled = false;
    }
  });
}

// Download button
if (btnDownload) {
  btnDownload.addEventListener('click', () => {
    downloadImageWithOverlays();
  });
}

// Clear ROIs button
if (btnClearRois) {
  btnClearRois.addEventListener('click', () => {
    if (state.userDrawnRois.length === 0) {
      setStatus('No ROIs to clear');
      return;
    }

    const count = state.userDrawnRois.length;
    state.userDrawnRois = [];
    renderOverlays();
    setStatus(`Cleared ${count} ROIs`);
  });
}

function downloadImageWithOverlays() {
  try {
    setStatus('Preparing download...');

    if (!state.currentImageObject) {
      setStatus('No image to download');
      return;
    }

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    const img = new Image();
    img.onload = function() {
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      tempCtx.drawImage(img, 0, 0);

      // Calculate scale factors
      const scaleX = img.width / (overlayCanvas?.width || 1);
      const scaleY = img.height / (overlayCanvas?.height || 1);

      // Draw user-drawn ROIs
      if (state.showUserDrawnRois && state.userDrawnRois.length > 0) {
        tempCtx.save();
        tempCtx.strokeStyle = '#00FFFF';
        tempCtx.lineWidth = 3;
        tempCtx.fillStyle = 'rgba(0, 255, 255, 0.15)';
        tempCtx.font = 'bold 16px Arial';

        state.userDrawnRois.forEach((roi) => {
          const x1 = roi.xmin * scaleX;
          const y1 = roi.ymin * scaleY;
          const x2 = roi.xmax * scaleX;
          const y2 = roi.ymax * scaleY;

          tempCtx.fillRect(x1, y1, x2 - x1, y2 - y1);
          tempCtx.strokeRect(x1, y1, x2 - x1, y2 - y1);

          if (roi.label) {
            tempCtx.fillStyle = '#fff';
            tempCtx.fillText(roi.label, x1 + 5, y1 + 20);
            tempCtx.fillStyle = 'rgba(0, 255, 255, 0.15)';
          }
        });
        tempCtx.restore();
      }

      // Draw AI detection boxes
      if (state.showAIDetections && state.lastBoxes.length > 0) {
        tempCtx.save();
        tempCtx.strokeStyle = '#FF6B6B';
        tempCtx.lineWidth = 2;
        tempCtx.font = '12px Arial';

        state.lastBoxes.forEach((box: any) => {
          const x1 = box.xmin * scaleX;
          const y1 = box.ymin * scaleY;
          const x2 = box.xmax * scaleX;
          const y2 = box.ymax * scaleY;

          tempCtx.strokeRect(x1, y1, x2 - x1, y2 - y1);

          if (box.label) {
            tempCtx.fillStyle = 'rgba(255, 107, 107, 0.8)';
            tempCtx.fillRect(x1, y1 - 16, tempCtx.measureText(box.label).width + 8, 16);
            tempCtx.fillStyle = '#fff';
            tempCtx.fillText(box.label, x1 + 4, y1 - 2);
          }
        });
        tempCtx.restore();
      }

      // Download
      tempCanvas.toBlob((blob) => {
        if (!blob) {
          setStatus('Download failed');
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cervical-image-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        setStatus('Download complete');
      });
    };

    img.src = state.currentImageObject.src;
  } catch (error) {
    console.error('Download error:', error);
    setStatus('Download failed');
  }
}

// Setup responsive features
function setupResponsiveFeatures() {
  // Add resize listener for canvas
  window.addEventListener('resize', () => {
    debouncedResize(renderOverlays, state.nv);
  });

  // Use ResizeObserver to detect when the viewer container changes size
  const viewer = document.getElementById('viewer');
  if (viewer && window.ResizeObserver) {
    const resizeObserver = new ResizeObserver(() => {
      debouncedResize(renderOverlays, state.nv);
    });
    resizeObserver.observe(viewer);
  }

  // Add orientation change listener for mobile devices
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      debouncedResize(renderOverlays, state.nv);
      if (state.nv && typeof state.nv.resize === 'function') {
        state.nv.resize();
      }
    }, 500);
  });

  // Setup touch events for better mobile interaction
  if (glCanvas) {
    glCanvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
    }, { passive: false });

    glCanvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
    }, { passive: false });

    glCanvas.addEventListener('touchend', (e) => {
      e.preventDefault();
    }, { passive: false });
  }

  // Handle viewport changes
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    debouncedResize(renderOverlays, state.nv);
  });
}
}

function rectToSnapshot(rect: DOMRect | null): { left: number; top: number; width: number; height: number } | null {
  if (!rect) return null;
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  };
}

function setupViewerDebugHelpers() {
  if (typeof window === 'undefined') {
    return;
  }

  window.__viewerDebug = {
    getAlignmentSnapshot: () => {
      const imageCanvas = document.getElementById('imageCanvas') as HTMLCanvasElement | null;
      const overlayRect = overlayCanvas ? overlayCanvas.getBoundingClientRect() : null;
      const glRect = glCanvas ? glCanvas.getBoundingClientRect() : null;

      return {
        transform: { ...state.transform },
        zoomLevel: state.currentZoomLevel,
        pan: { x: state.panX, y: state.panY },
        containerSize: coordinateTransform.getContainerSize(),
        fixedCanvas: state.fixedCanvasPixelSize ? { ...state.fixedCanvasPixelSize } : null,
        boundingRects: {
          imageCanvas: rectToSnapshot(imageCanvas ? imageCanvas.getBoundingClientRect() : null),
          overlayCanvas: rectToSnapshot(overlayRect),
          glCanvas: rectToSnapshot(glRect)
        },
        imageDimensions: { ...state.currentImageDimensions },
        visualViewport: window.visualViewport
          ? {
              width: window.visualViewport.width,
              height: window.visualViewport.height,
              scale: window.visualViewport.scale
            }
          : null,
        devicePixelRatio: window.devicePixelRatio || 1
      };
    },
    getUserRois: () => state.userDrawnRois.map((roi) => {
      const { _deleteButton, ...rest } = roi;
      return { ...rest };
    }),
    forceTransformRecalc: () => coordinateTransform.recalculateTransform(),
    addSyntheticRoi: (canvasRect: { x: number; y: number; width: number; height: number }) => {
      if (!canvasRect) return null;
      const topLeft = coordinateTransform.canvasLogicalToImage(canvasRect.x, canvasRect.y);
      const bottomRight = coordinateTransform.canvasLogicalToImage(
        canvasRect.x + canvasRect.width,
        canvasRect.y + canvasRect.height
      );
      const roi = {
        xmin: topLeft.x,
        ymin: topLeft.y,
        xmax: bottomRight.x,
        ymax: bottomRight.y,
        label: 'synthetic',
      };
      state.userDrawnRois.push(roi);
      renderOverlays();
      return { ...roi };
    },
    getCanvasContainerSize,
    lastDrawnUserRois: [] as Array<{ topLeft: { x: number; y: number }; bottomRight: { x: number; y: number } }>,
  };
}

setupViewerDebugHelpers();

// Initialize everything
setupDragAndDrop();
setupDrawingMode();
setupZoomHandlers();
setupResponsiveFeatures();

// Defer initial load until after page layout
setTimeout(() => {
  updateCanvasSize();
  loadCaseFromUrl().catch(e => {
    console.error('Failed to load initial case:', e);
    setStatus('error');
    showSpinner(false);
  });
}, 100);
