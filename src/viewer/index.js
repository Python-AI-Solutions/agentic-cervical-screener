import { fetchCase, resolveUri } from '../api/cqaiClient.js';
import { classify } from '../api/classifyClient.js?v=3';
import { addLayerToNiivue, drawLabeledBoxes, drawGeoJSON } from './overlayAdapters.js';
import { collectRois } from './roiNav.js';

const statusEl     = document.getElementById('status');
const spinnerEl    = document.getElementById('spinner');
const layersEl     = document.getElementById('layers');
const mobileLayersEl = document.getElementById('mobileLayers');
const btnClassify  = document.getElementById('btnClassify');
const btnDownload  = document.getElementById('btnDownload');
const btnClearRois = document.getElementById('btnClearRois');

const glCanvas     = document.getElementById('glCanvas');
const overlayCanvas= document.getElementById('overlayCanvas');
const overlayCtx   = overlayCanvas.getContext('2d');

// Don't set inline styles - CSS from index.html handles all positioning

/**
 * Returns the size of the Niivue viewer container independent of any inline
 * sizing we might apply to the canvases themselves. This lets us respond to
 * responsive layout changes (desktop ↔︎ mobile) where CSS alters the container
 * dimensions but previously cached inline canvas sizes would otherwise win.
 */
function getCanvasContainerSize() {
  if (!glCanvas) return { width: 0, height: 0 };
  const container = glCanvas.parentElement || glCanvas;
  const rect = container.getBoundingClientRect();
  if (rect.width && rect.height) {
    return { width: rect.width, height: rect.height };
  }
  return {
    width: glCanvas.clientWidth || 0,
    height: glCanvas.clientHeight || 0,
  };
}

function ensureImageCanvas() {
  if (!glCanvas) return null;
  let imageCanvas = document.getElementById('imageCanvas');
  if (!imageCanvas) {
    imageCanvas = document.createElement('canvas');
    imageCanvas.id = 'imageCanvas';
    // Don't set inline styles - let CSS handle positioning from index.html
    glCanvas.parentNode.insertBefore(imageCanvas, overlayCanvas);
  }
  return imageCanvas;
}

const transform = { scale:1, tx:0, ty:0 };
let nv=null, rois=[], currentSlideId=null, currentSlideUri=null, lastLoadedCase=null;
let layerCache = new Map();          // layer_id -> FeatureCollection (for rects/points)
let visibleLayers = new Set();       // layer_ids currently shown
let lastBoxes = [];                  // boxes from last classify
// Removed roiMode - drawing is now always available
let showAIDetections = true;         // Whether to show AI classification boxes
let caseCache = new Map();           // Cache for case data to avoid re-fetching

// Drawing mode variables
let isDrawing = false;
let drawingStart = null;
let drawingRect = null;
let userDrawnRois = [];              // User-drawn rectangles
let showUserDrawnRois = true;        // Toggle for user-drawn rectangles visibility
let currentImageFile = null;         // Store the current image file for classification
let hoveredRoiIndex = -1;            // Index of currently hovered ROI (-1 if none)
let currentImageDimensions = { width: 1024, height: 1024 }; // Store actual image dimensions
let currentImageObject = null;       // Store the current image object for redrawing on resize
// CRITICAL: Fixed canvas dimensions - set once at image load, NEVER changes with browser zoom
let fixedCanvasPixelSize = null;     // { width, height } in actual pixels
// Zoom variables
let currentZoomLevel = 1.0;          // Current zoom level (1.0 = fit to window)
let panX = 0;                        // Pan offset X
let panY = 0;                        // Pan offset Y
let lastTouchDistance = 0;           // For pinch zoom detection

// Available labels for cervical cytology
const CERVICAL_LABELS = [
  'Negative for intraepithelial lesion',
  'ASC-US',
  'ASC-H',
  'LSIL',
  'HSIL',
  'SCC'
];

function setStatus(s){ statusEl.textContent=s; }
function showSpinner(v){
  if (spinnerEl) {
    spinnerEl.hidden = !v;
  }
}
// Update canvas size to match container - NiiVue style responsive handling
function updateCanvasSize() {
  if (!glCanvas || !overlayCanvas) return false;

  const prevGlWidthStyle = glCanvas.style.width;
  const prevGlHeightStyle = glCanvas.style.height;
  const prevOverlayWidthStyle = overlayCanvas.style.width;
  const prevOverlayHeightStyle = overlayCanvas.style.height;
  const imageCanvas = document.getElementById('imageCanvas');
  const prevImageWidthStyle = imageCanvas?.style.width ?? '';
  const prevImageHeightStyle = imageCanvas?.style.height ?? '';

  // Let CSS dictate the new layout before we measure so responsive changes are applied.
  glCanvas.style.width = '';
  glCanvas.style.height = '';
  overlayCanvas.style.width = '';
  overlayCanvas.style.height = '';
  if (imageCanvas) {
    imageCanvas.style.width = '';
    imageCanvas.style.height = '';
  }

  // Measure the responsive container instead of the canvas itself so we react
  // to layout changes (e.g. switching between desktop and mobile breakpoints).
  const { width, height } = getCanvasContainerSize();

  // Defensive check: if canvas hasn't been laid out yet, skip sizing
  if (width === 0 || height === 0) {
    // Restore previous inline styles so we don't leave canvases unset
    glCanvas.style.width = prevGlWidthStyle;
    glCanvas.style.height = prevGlHeightStyle;
    overlayCanvas.style.width = prevOverlayWidthStyle;
    overlayCanvas.style.height = prevOverlayHeightStyle;
    if (imageCanvas) {
      imageCanvas.style.width = prevImageWidthStyle;
      imageCanvas.style.height = prevImageHeightStyle;
    }
    console.warn('⚠️ Canvas not laid out yet (dimensions: ' + width + 'x' + height + '), skipping size update');
    return false;
  }

  // Account for device pixel ratio for crisp rendering
  const dpr = window.devicePixelRatio || 1;
  const roundedWidth = Math.round(width);
  const roundedHeight = Math.round(height);
  const actualWidth = Math.round(roundedWidth * dpr);
  const actualHeight = Math.round(roundedHeight * dpr);

  let sizeChanged = false;

  // Only update heavy pixel buffers if something actually changed
  if (glCanvas.width !== actualWidth || glCanvas.height !== actualHeight) {
    // Set canvas resolution (actual pixels)
    glCanvas.width = actualWidth;
    glCanvas.height = actualHeight;
    overlayCanvas.width = actualWidth;
    overlayCanvas.height = actualHeight;
    if (imageCanvas) {
      imageCanvas.width = actualWidth;
      imageCanvas.height = actualHeight;
    }

    // Scale overlay context for high DPI
    const overlayCtx = overlayCanvas.getContext('2d');
    if (overlayCtx) {
      overlayCtx.setTransform(1, 0, 0, 1, 0, 0); // Reset first
      overlayCtx.scale(dpr, dpr);
    }

    console.log('✅ Canvas size updated:', {
      displaySize: { width, height },
      actualPixels: { width: actualWidth, height: actualHeight },
      dpr,
      timestamp: new Date().toLocaleTimeString()
    });
    sizeChanged = true;
  }

  const styleWidthPx = `${roundedWidth}px`;
  const styleHeightPx = `${roundedHeight}px`;
  glCanvas.style.width = styleWidthPx;
  glCanvas.style.height = styleHeightPx;
  overlayCanvas.style.width = styleWidthPx;
  overlayCanvas.style.height = styleHeightPx;
  if (imageCanvas) {
    imageCanvas.style.width = styleWidthPx;
    imageCanvas.style.height = styleHeightPx;
  }

  return sizeChanged;
}

function fitOverlayToImage(imageWidth, imageHeight) {
  // Get container dimensions ONCE when image loads
  const { width: containerWidthRaw, height: containerHeightRaw } = getCanvasContainerSize();
  const containerWidth = Math.round(containerWidthRaw);
  const containerHeight = Math.round(containerHeightRaw);

  if (containerWidth === 0 || containerHeight === 0) {
    console.warn('⚠️ fitOverlayToImage skipped - container has zero size', { containerWidthRaw, containerHeightRaw });
    return;
  }

  // CRITICAL: FREEZE canvas pixel dimensions at image load
  // These will NEVER change, even with browser zoom
  const dpr = window.devicePixelRatio || 1;
  fixedCanvasPixelSize = {
    width: Math.round(containerWidth * dpr),
    height: Math.round(containerHeight * dpr),
    logicalWidth: containerWidth,
    logicalHeight: containerHeight
  };

  // Calculate scale to fit image in container
  const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);

  // Center the image
  const scaledWidth = imageWidth * scale;
  const scaledHeight = imageHeight * scale;
  const tx = (containerWidth - scaledWidth) / 2;
  const ty = (containerHeight - scaledHeight) / 2;

  // Set transform ONCE - it won't be recalculated on browser zoom
  transform.scale = scale;
  transform.tx = tx;
  transform.ty = ty;

  console.log('✅ Canvas size and transform FROZEN (immune to browser zoom):', {
    imageSize: { width: imageWidth, height: imageHeight },
    fixedCanvasPixelSize,
    transform: { scale, tx, ty }
  });
}

function handleCanvasResize() {
  const sizeChanged = updateCanvasSize();

  if (currentImageObject) {
    // CRITICAL: DO NOT recalculate transform on browser zoom/resize
    // The transform is in IMAGE PIXEL coordinates and should NOT change with browser zoom
    // Only redraw the canvases using the EXISTING transform
    renderImageCanvas();
    renderOverlays();
    return;
  }

  if (sizeChanged && (lastBoxes.length > 0 || layerCache.size > 0 || userDrawnRois.length > 0)) {
    renderOverlays();
  }
}

// Debounced resize handler with layout settling
let resizeTimeout;
function debouncedResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    // Use requestAnimationFrame to ensure CSS layout has been recalculated
    requestAnimationFrame(() => {
      handleCanvasResize();
      // Also trigger NiiVue resize if available
      if (nv && typeof nv.resize === 'function') {
        nv.resize();
      }
    });
  }, 100);
}

function renderImageCanvas() {
  if (!currentImageObject || !fixedCanvasPixelSize) {
    return;
  }

  // Hide the drop zone when image is loaded
  const dropZone = document.getElementById('dropZone');
  if (dropZone) {
    dropZone.style.display = 'none';
  }

  const imageCanvas = ensureImageCanvas();
  if (!imageCanvas) return;

  // CRITICAL: Use FIXED pixel size for canvas buffer (NEVER changes with browser zoom)
  if (imageCanvas.width !== fixedCanvasPixelSize.width || imageCanvas.height !== fixedCanvasPixelSize.height) {
    imageCanvas.width = fixedCanvasPixelSize.width;
    imageCanvas.height = fixedCanvasPixelSize.height;
  }

  // CSS size adapts to current viewport (changes with browser zoom, but pixels don't)
  const { width: currentContainerWidth, height: currentContainerHeight } = getCanvasContainerSize();
  imageCanvas.style.width = `${Math.round(currentContainerWidth)}px`;
  imageCanvas.style.height = `${Math.round(currentContainerHeight)}px`;

  const ctx = imageCanvas.getContext('2d');
  if (!ctx) return;

  // Use the ORIGINAL DPR from when canvas was sized
  const dpr = fixedCanvasPixelSize.width / fixedCanvasPixelSize.logicalWidth;

  // Reset and apply DPR scaling
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, fixedCanvasPixelSize.logicalWidth, fixedCanvasPixelSize.logicalHeight);

  const imgWidth = currentImageDimensions?.width || currentImageObject.width;
  const imgHeight = currentImageDimensions?.height || currentImageObject.height;

  // Calculate screen position using transform (which stays constant)
  const drawX = transform.tx;
  const drawY = transform.ty;
  const drawWidth = imgWidth * transform.scale;
  const drawHeight = imgHeight * transform.scale;

  // Draw image at calculated screen coordinates
  ctx.drawImage(currentImageObject, drawX, drawY, drawWidth, drawHeight);

  console.log('🖼️ Image canvas rendered (FIXED pixel buffer, CSS adapts):', {
    fixedPixelSize: fixedCanvasPixelSize,
    currentCSSSize: { width: currentContainerWidth, height: currentContainerHeight },
    imageSize: { width: imgWidth, height: imgHeight },
    screenPosition: { drawX, drawY, drawWidth, drawHeight },
    transform: { ...transform }
  });
}

function redrawCurrentImage({ ensureSize = false, reason = 'resize' } = {}) {
  if (!currentImageObject) {
    return false;
  }

  if (ensureSize) {
    updateCanvasSize();
  }

  const { width, height } = currentImageDimensions || {};
  if (width && height) {
    fitOverlayToImage(width, height);
  }

  renderImageCanvas();

  renderOverlays();

  console.log('♻️ Image redraw complete:', {
    reason,
    containerSize: getCanvasContainerSize(),
    imageSize: currentImageDimensions
  });

  return true;
}

// Make loadCaseFromUrl available globally for quick case buttons
window.loadCaseFromUrl = async function loadCaseFromUrl(url){
  setStatus('loading…'); showSpinner(true);
  if (layersEl) layersEl.innerHTML='';
  if (mobileLayersEl) mobileLayersEl.innerHTML='';
  overlayCtx.clearRect(0,0,overlayCanvas.width,overlayCanvas.height);
  rois=[]; layerCache.clear(); visibleLayers.clear(); lastBoxes = [];
  userDrawnRois = []; // Clear user-drawn ROIs
  currentImageFile = null; // Clear current image file
  currentImageDimensions = { width: 1024, height: 1024 }; // Reset dimensions
  currentImageObject = null; // Clear stored image object
  fixedCanvasPixelSize = null; // Clear fixed canvas size - will be recalculated for new image
  showAIDetections = true; // Reset AI detections visibility
  currentZoomLevel = 1.0; // Reset zoom
  panX = 0; // Reset pan
  panY = 0; // Reset pan
  lastTouchDistance = 0; // Reset pinch distance

  // Show drop zone when loading new case
  const dropZone = document.getElementById('dropZone');
  if (dropZone) {
    dropZone.style.display = 'block';
  }

  const NvCtor = window.Niivue || (window.niivue && window.niivue.Niivue);
  if (!NvCtor) throw new Error('Niivue not loaded');
  nv = new NvCtor({ isResizeCanvas: true }); await nv.attachTo('glCanvas');

  let doc=null;
  if (url){
    // Check cache first
    if (caseCache.has(url)) {
      doc = caseCache.get(url);
      console.log('Using cached case data for:', url);
    } else {
      const r=await fetch(url, { cache:'no-store' });
      if(!r.ok) throw new Error('case json fetch failed');
      doc=await r.json();
      caseCache.set(url, doc); // Cache the result
      console.log('Cached case data for:', url);
    }
  }
  else {
    doc=await fetchCase();
  }
  lastLoadedCase=doc;
  const slide=doc.slides?.[0]; if(!slide) throw new Error('no slides');
  currentSlideId=slide.slide_id||'SLIDE-001'; currentSlideUri=slide.uri;

  const imgUrl=resolveUri(slide.uri);

  // Load image asynchronously
  const loadImage = async () => {
    if (/\.(png|jpg|jpeg)$/i.test(imgUrl)) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            currentImageDimensions = { width: img.width, height: img.height };
            currentImageObject = img; // Store for redrawing on resize
            redrawCurrentImage({ ensureSize: true, reason: 'case-load' });
            setStatus('ready');
            showSpinner(false);
            resolve(img);
          } catch (e) {
            console.error('Error rendering image:', e);
            reject(e);
          }
        };
        img.onerror = () => {
          console.error('Failed to load image:', imgUrl);
          setStatus('error loading image');
          showSpinner(false);
          reject(new Error('Image load failed'));
        };
        img.src = imgUrl;
      });
    } else {
      try {
        await nv.loadImages([{ url: imgUrl, name:'slide', colormap:'gray', opacity:1 }]);
        const img = new Image();
        img.onload=()=>{
          currentImageDimensions = { width: img.width, height: img.height };
          currentImageObject = img; // Store for redrawing on resize
          redrawCurrentImage({ ensureSize: true, reason: 'case-load-nonpng' });
        };
        img.src=imgUrl;
        setStatus('ready'); showSpinner(false);
        return img;
      } catch (error) {
        console.warn('unsupported image format for demo:', imgUrl, error);
        fitOverlayToImage(1024,1024); renderOverlays();
        setStatus('ready'); showSpinner(false);
        return null;
      }
    }
  };

  // Start image loading immediately (non-blocking)
  loadImage().catch(console.error);

  // Add user-drawn ROIs toggle
  addUserDrawnRoisToggle();

  // Build layer controls + prefetch & cache asynchronously
  const layerPromises = (slide.layers||[]).map(async (L) => {
    // UI - create immediately for better UX (add to both desktop and mobile)
    visibleLayers.add(L.layer_id);
    addLayerToggle(L.layer_id, L.geometry, true);


    // Cache data asynchronously (non-blocking)
    try {
      const fc = await addLayerToNiivue(nv, L, resolveUri, overlayCtx, transform);
      if (fc) {
        layerCache.set(L.layer_id, { fc, colorKind: L.kind });
        // ROIs: collect from rect-like layers the first time
        if (L.geometry === 'rects' || L.kind === 'roi') {
          try { rois.push(...collectRois(fc)); } catch {}
        }
        // Don't render overlays here - we only want user-drawn ROIs
      }
    } catch (e) { console.warn('layer load failed', L.layer_id, e); }
  });

  // Process layers in background (non-blocking)
  Promise.allSettled(layerPromises).then(() => {
    console.log('All layers processed');
  });

  // Note: setStatus('ready') and showSpinner(false) are now called in img.onload for PNG images
  // For medical formats, they're still called here
  if (!/\.(png|jpg|jpeg)$/i.test(imgUrl)) {
    setStatus('ready'); showSpinner(false);
  }
}

function renderOverlays(){
  console.log('🎨 renderOverlays called:', { showUserDrawnRois, showAIDetections, lastBoxesLength: lastBoxes.length, transform });

  if (!fixedCanvasPixelSize) {
    console.warn('⚠️ renderOverlays skipped - fixedCanvasPixelSize not set');
    return;
  }

  // CRITICAL: Use FIXED pixel size for overlay canvas buffer (matches imageCanvas)
  if (overlayCanvas.width !== fixedCanvasPixelSize.width || overlayCanvas.height !== fixedCanvasPixelSize.height) {
    overlayCanvas.width = fixedCanvasPixelSize.width;
    overlayCanvas.height = fixedCanvasPixelSize.height;
  }

  // CSS size adapts to current viewport (same as imageCanvas)
  const { width: currentContainerWidth, height: currentContainerHeight } = getCanvasContainerSize();
  overlayCanvas.style.width = `${Math.round(currentContainerWidth)}px`;
  overlayCanvas.style.height = `${Math.round(currentContainerHeight)}px`;

  // Use the ORIGINAL DPR from when canvas was sized
  const dpr = fixedCanvasPixelSize.width / fixedCanvasPixelSize.logicalWidth;

  // Reset transform and reapply DPR scaling
  overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
  overlayCtx.scale(dpr, dpr);

  // Clear using FIXED logical dimensions
  overlayCtx.clearRect(0, 0, fixedCanvasPixelSize.logicalWidth, fixedCanvasPixelSize.logicalHeight);

  // Only show user-drawn ROIs
  if (showUserDrawnRois) {
    console.log('🎨 Drawing user-drawn ROIs');
    drawUserRois();
  }

  // Show AI detection boxes if enabled
  if (showAIDetections) {
    console.log('🎨 Drawing AI detection boxes');
    drawLabeledBoxes(overlayCtx, lastBoxes, transform);
  } else {
    console.log('🎨 Not drawing AI boxes:', { showAIDetections });
  }
}

function addLayerToggle(layerId, geometry, checked = true) {
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
      checkboxes.forEach(checkbox => checkbox.checked = cb.checked);

      // Handle specific layer behaviors
      if (layerId === 'ai-detections') {
        showAIDetections = cb.checked;
      } else if (layerId === 'user-drawn-rois') {
        showUserDrawnRois = cb.checked;
      } else {
        // Handle regular layers
        cb.checked ? visibleLayers.add(layerId) : visibleLayers.delete(layerId);
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


// Image file loading
const imageFileInput = document.getElementById('imageFile');
const btnLoadImage = document.getElementById('btnLoadImage');

if (btnLoadImage) {
  btnLoadImage.addEventListener('click', () => {
    imageFileInput.click();
  });
}

if (imageFileInput) {
  imageFileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    console.log('File input changed:', files);
    if (files.length > 0) {
      console.log('Selected file:', files[0]);
      handleDroppedFiles(files);
    }
    // Reset the input so the same file can be selected again
    e.target.value = '';
  });
}

btnClassify.addEventListener('click', async ()=>{
  try {
    setStatus('classifying…'); showSpinner(true); btnClassify.disabled = true;
    console.log('🔍 Classification request:', { currentSlideId, currentSlideUri, currentImageFile });
    console.log('🔍 currentImageFile type:', typeof currentImageFile);
    console.log('🔍 currentImageFile instanceof File:', currentImageFile instanceof File);

    const res=await classify(currentSlideId, currentSlideUri, currentImageFile);
    console.log('🔍 Classification response:', res);

    lastBoxes = res.boxes || [];
    console.log('🔍 Classification complete:', {
      boxCount: lastBoxes.length,
      firstBox: lastBoxes[0],
      currentImageDimensions,
      currentTransform: { ...transform },
      note: 'Boxes MUST be in image pixel coordinates (0 to imageWidth/Height)'
    });

    // Add AI detections toggle if it doesn't exist
    addAIDetectionsToggle();

    // Keep AI detections visible after classification

    // Keep cursor as crosshair for drawing
    overlayCanvas.style.cursor = 'crosshair';

    renderOverlays();
    setStatus(`classified - ${lastBoxes.length} detections found - switched to AI mode`);
  } catch(e){
    console.error('❌ Classification error:', e);
    setStatus('classification failed: ' + e.message);
  }
  finally { showSpinner(false); btnClassify.disabled = false; }
});


btnDownload.addEventListener('click', () => {
  downloadImageWithOverlays();
});

btnClearRois.addEventListener('click', () => {
  if (userDrawnRois.length === 0) {
    setStatus('No ROIs to clear');
    return;
  }

  const count = userDrawnRois.length;
  userDrawnRois = [];
  renderOverlays();
  setStatus(`Cleared ${count} ROIs`);
});

function getCurrentRois() {
  // Return user-drawn ROIs if available, otherwise use loaded ground truth ROIs
  return userDrawnRois.length > 0 ? userDrawnRois : rois;
}


// Drag and Drop functionality
function setupDragAndDrop() {
  const viewer = document.getElementById('viewer');

  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    viewer.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  // Highlight drop zone when dragging over
  ['dragenter', 'dragover'].forEach(eventName => {
    viewer.addEventListener(eventName, highlightDropZone, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    viewer.addEventListener(eventName, unhighlightDropZone, false);
  });

  // Handle dropped files
  viewer.addEventListener('drop', handleDrop, false);

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function highlightDropZone(e) {
    viewer.style.backgroundColor = 'rgba(0, 229, 255, 0.1)';
    viewer.style.border = '2px dashed #00E5FF';
    setStatus('Drop image here to load from computer...');
  }

  function unhighlightDropZone(e) {
    viewer.style.backgroundColor = '';
    viewer.style.border = '';
  }

  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
      handleDroppedFiles(files);
    }
  }
}

function handleDroppedFiles(files) {
  const file = files[0];
  console.log('handleDroppedFiles called with:', file);

  // Check if it's an image file
  if (file.type.startsWith('image/')) {
    setStatus(`Loading ${file.name}...`);
    showSpinner(true);

    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        // Clear existing content
        if (layersEl) layersEl.innerHTML = '';
        if (mobileLayersEl) mobileLayersEl.innerHTML = '';
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        layerCache.clear();
        visibleLayers.clear();
        lastBoxes = [];
        rois = [];
        userDrawnRois = []; // Clear user-drawn ROIs
        currentImageFile = null; // Clear current image file
        currentImageDimensions = { width: 1024, height: 1024 }; // Reset dimensions
        currentImageObject = null; // Clear stored image object
        fixedCanvasPixelSize = null; // Clear fixed canvas size - will be recalculated for new image

        // Display the new image
        // Store actual image dimensions
        currentImageDimensions = { width: img.width, height: img.height };
        currentImageObject = img; // Store the image object
        redrawCurrentImage({ ensureSize: true, reason: 'file-drop' });

        // Update current slide info
        currentSlideId = `DROPPED-${Date.now()}`;
        currentSlideUri = file.name;
        currentImageFile = file; // Store the file for classification
        console.log('Set currentImageFile:', currentImageFile);

        // Set ROI mode to AI detections for custom images
        console.log('Custom image loaded');

        // Update UI
        setStatus(`${file.name} loaded - ${img.width}×${img.height}px`);
        showSpinner(false);

        // Add user-drawn ROIs toggle for dropped images
        addUserDrawnRoisToggle();
      };

      img.onerror = function() {
        setStatus(`Failed to load ${file.name}`);
        showSpinner(false);
      };

      img.src = e.target.result;
    };

    reader.onerror = function() {
      setStatus(`Failed to read ${file.name}`);
      showSpinner(false);
    };

    reader.readAsDataURL(file);
  } else {
    setStatus(`Unsupported file type: ${file.type}. Please drop an image file (PNG, JPG, etc.)`);
  }
}

// Drawing functionality
function setupDrawingMode() {
  if (!overlayCanvas) return;

  // Enable pointer events for drawing
  overlayCanvas.style.pointerEvents = 'auto';
  overlayCanvas.style.cursor = 'crosshair';

  // Mouse events for drawing
  overlayCanvas.addEventListener('mousedown', handleMouseDown);
  overlayCanvas.addEventListener('mousemove', handleMouseMove);
  overlayCanvas.addEventListener('mouseup', handleMouseUp);
  overlayCanvas.addEventListener('mouseleave', handleMouseUp);

  // Mouse events for hover detection
  overlayCanvas.addEventListener('mousemove', handleMouseMoveHover);
  overlayCanvas.addEventListener('mouseleave', () => {
    if (hoveredRoiIndex !== -1) {
      hoveredRoiIndex = -1;
      renderOverlays();
    }
  });

  // Touch events for mobile
  overlayCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  overlayCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  overlayCanvas.addEventListener('touchend', handleTouchEnd, { passive: false });

  // Touch events for hover detection on mobile
  overlayCanvas.addEventListener('touchmove', handleTouchMoveHover, { passive: false });
}

function handleMouseDown(e) {
  console.log('Mouse down event', { isDrawing });

  const rect = overlayCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Check if clicking on a delete button (only if hovering over one)
  if (hoveredRoiIndex >= 0 && hoveredRoiIndex < userDrawnRois.length) {
    const roi = userDrawnRois[hoveredRoiIndex];
    if (roi._deleteButton) {
      const deleteBtn = roi._deleteButton;
      if (x >= deleteBtn.x && x <= deleteBtn.x + deleteBtn.width &&
          y >= deleteBtn.y && y <= deleteBtn.y + deleteBtn.height) {
        // Delete this ROI
        userDrawnRois.splice(hoveredRoiIndex, 1);
        hoveredRoiIndex = -1;
        setStatus(`Deleted ROI. Total ROIs: ${userDrawnRois.length}`);
        renderOverlays();
        return;
      }
    }
  }

  console.log('Starting drawing at', { x, y });
  startDrawing(x, y);
}

function handleMouseMove(e) {
  if (!isDrawing) return;

  const rect = overlayCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  updateDrawing(x, y);
}

function handleMouseMoveHover(e) {

  const rect = overlayCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Check if hovering over any ROI rectangle (not just the delete button)
  let newHoveredIndex = -1;
  for (let i = 0; i < userDrawnRois.length; i++) {
    const roi = userDrawnRois[i];
    // Convert ROI coordinates to screen coordinates
    const x1 = roi.xmin * transform.scale + transform.tx;
    const y1 = roi.ymin * transform.scale + transform.ty;
    const x2 = roi.xmax * transform.scale + transform.tx;
    const y2 = roi.ymax * transform.scale + transform.ty;

    // Check if mouse is within the ROI rectangle
    if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
      newHoveredIndex = i;
      break;
    }
  }

  // Update hover state and redraw if changed
  if (newHoveredIndex !== hoveredRoiIndex) {
    hoveredRoiIndex = newHoveredIndex;
    renderOverlays();
  }
}

function handleMouseUp(e) {
  if (!isDrawing) return;

  const rect = overlayCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  finishDrawing(x, y);
}

function handleTouchStart(e) {
  e.preventDefault();

  const rect = overlayCanvas.getBoundingClientRect();
  const touch = e.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  // Check if clicking on a delete button (only if hovering over one)
  if (hoveredRoiIndex >= 0 && hoveredRoiIndex < userDrawnRois.length) {
    const roi = userDrawnRois[hoveredRoiIndex];
    if (roi._deleteButton) {
      const deleteBtn = roi._deleteButton;
      if (x >= deleteBtn.x && x <= deleteBtn.x + deleteBtn.width &&
          y >= deleteBtn.y && y <= deleteBtn.y + deleteBtn.height) {
        // Delete this ROI
        userDrawnRois.splice(hoveredRoiIndex, 1);
        hoveredRoiIndex = -1;
        setStatus(`Deleted ROI. Total ROIs: ${userDrawnRois.length}`);
        renderOverlays();
        return;
      }
    }
  }

  startDrawing(x, y);
}

function handleTouchMoveHover(e) {
  e.preventDefault();

  const rect = overlayCanvas.getBoundingClientRect();
  const touch = e.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  // Check if hovering over any ROI rectangle (not just the delete button)
  let newHoveredIndex = -1;
  for (let i = 0; i < userDrawnRois.length; i++) {
    const roi = userDrawnRois[i];
    // Convert ROI coordinates to screen coordinates
    const x1 = roi.xmin * transform.scale + transform.tx;
    const y1 = roi.ymin * transform.scale + transform.ty;
    const x2 = roi.xmax * transform.scale + transform.tx;
    const y2 = roi.ymax * transform.scale + transform.ty;

    // Check if touch is within the ROI rectangle
    if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
      newHoveredIndex = i;
      break;
    }
  }

  // Update hover state and redraw if changed
  if (newHoveredIndex !== hoveredRoiIndex) {
    hoveredRoiIndex = newHoveredIndex;
    renderOverlays();
  }
}

function handleTouchMove(e) {
  e.preventDefault();
  if (!isDrawing) return;

  const rect = overlayCanvas.getBoundingClientRect();
  const touch = e.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  updateDrawing(x, y);
}

function handleTouchEnd(e) {
  e.preventDefault();
  if (!isDrawing) return;

  const rect = overlayCanvas.getBoundingClientRect();
  const touch = e.changedTouches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  finishDrawing(x, y);
}

function startDrawing(x, y) {
  console.log('Starting drawing', { x, y });
  isDrawing = true;
  drawingStart = { x, y };
  drawingRect = { x, y, width: 0, height: 0 };
  setStatus('Drawing rectangle... (release to finish)');
}

function updateDrawing(x, y) {
  if (!isDrawing || !drawingStart) return;

  drawingRect = {
    x: Math.min(drawingStart.x, x),
    y: Math.min(drawingStart.y, y),
    width: Math.abs(x - drawingStart.x),
    height: Math.abs(y - drawingStart.y)
  };

  // Redraw overlays and current drawing
  renderOverlays();
  drawCurrentRectangle();
}

function finishDrawing(x, y) {
  if (!isDrawing || !drawingStart) return;

  const rect = {
    x: Math.min(drawingStart.x, x),
    y: Math.min(drawingStart.y, y),
    width: Math.abs(x - drawingStart.x),
    height: Math.abs(y - drawingStart.y)
  };

  // Only add if rectangle is large enough
  if (rect.width > 10 && rect.height > 10) {
    // Convert to image coordinates
    const imageRect = {
      xmin: (rect.x - transform.tx) / transform.scale,
      ymin: (rect.y - transform.ty) / transform.scale,
      xmax: (rect.x + rect.width - transform.tx) / transform.scale,
      ymax: (rect.y + rect.height - transform.ty) / transform.scale
    };

    // Show label selection dialog
    showLabelSelectionDialog(imageRect);
  }

  isDrawing = false;
  drawingStart = null;
  drawingRect = null;
  renderOverlays();
}

function drawCurrentRectangle() {
  if (!drawingRect) return;

  overlayCtx.save();
  overlayCtx.strokeStyle = '#FF6B6B';
  overlayCtx.lineWidth = 2;
  overlayCtx.setLineDash([5, 5]);
  overlayCtx.strokeRect(drawingRect.x, drawingRect.y, drawingRect.width, drawingRect.height);
  overlayCtx.restore();
}

function showLabelSelectionDialog(imageRect) {
  // Create modal dialog
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-lg);
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
  `;

  dialog.innerHTML = `
    <h3 style="margin: 0 0 var(--spacing-md) 0; color: var(--text-primary);">Select Labels</h3>
    <div style="margin-bottom: var(--spacing-md);">
      ${CERVICAL_LABELS.map((label, index) => `
        <label style="display: block; margin-bottom: var(--spacing-sm); cursor: pointer; color: var(--text-primary);">
          <input type="radio" name="label" value="${label}" ${index === 0 ? 'checked' : ''} style="margin-right: var(--spacing-sm);">
          ${label}
        </label>
      `).join('')}
    </div>
    <div style="display: flex; gap: var(--spacing-sm); justify-content: flex-end;">
      <button id="cancelLabel" style="background: var(--bg-button); color: var(--text-primary); border: 1px solid var(--border-color); padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--border-radius); cursor: pointer;">Cancel</button>
      <button id="confirmLabel" style="background: #1e40af; color: white; border: 1px solid #1e40af; padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--border-radius); cursor: pointer;">Add</button>
    </div>
  `;

  modal.appendChild(dialog);
  document.body.appendChild(modal);

  // Event listeners
  document.getElementById('cancelLabel').addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  document.getElementById('confirmLabel').addEventListener('click', () => {
    const selectedLabel = dialog.querySelector('input[name="label"]:checked').value;

    // Add label to the rectangle
    imageRect.label = selectedLabel;
    userDrawnRois.push(imageRect);

    setStatus(`Rectangle added with label: ${selectedLabel}. Total ROIs: ${userDrawnRois.length}`);
    renderOverlays();
    document.body.removeChild(modal);
  });

  // Close on escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      document.body.removeChild(modal);
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

function drawUserRois() {
  if (userDrawnRois.length === 0) return;

  overlayCtx.save();
  overlayCtx.font = 'bold 13px Arial';

  userDrawnRois.forEach((roi, index) => {
    const x1 = roi.xmin * transform.scale + transform.tx;
    const y1 = roi.ymin * transform.scale + transform.ty;
    const x2 = roi.xmax * transform.scale + transform.tx;
    const y2 = roi.ymax * transform.scale + transform.ty;

    // Determine if this ROI is being hovered
    const isHovered = hoveredRoiIndex === index;

    // Use bright, visible colors for manual ROIs
    if (isHovered) {
      // Bright yellow-orange for hover
      overlayCtx.strokeStyle = '#FF8C00';
      overlayCtx.lineWidth = 4;
      overlayCtx.fillStyle = 'rgba(255, 140, 0, 0.25)';
      // Add glow effect
      overlayCtx.shadowColor = '#FF8C00';
      overlayCtx.shadowBlur = 8;
    } else {
      // Bright cyan for normal state
      overlayCtx.strokeStyle = '#00FFFF';
      overlayCtx.lineWidth = 3;
      overlayCtx.fillStyle = 'rgba(0, 255, 255, 0.15)';
      overlayCtx.shadowBlur = 0;
    }

    // Draw rectangle
    overlayCtx.fillRect(x1, y1, x2 - x1, y2 - y1);
    overlayCtx.strokeRect(x1, y1, x2 - x1, y2 - y1);

    // Draw label with dark background for better visibility
    if (roi.label) {
      const labelText = `${index + 1}: ${roi.label}`;
      const textMetrics = overlayCtx.measureText(labelText);
      const textWidth = textMetrics.width;
      const textHeight = 15;

      // Draw dark background rectangle for text
      overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      overlayCtx.fillRect(x1, y1 - textHeight - 2, textWidth + 8, textHeight + 4);

      // Draw white text
      overlayCtx.fillStyle = '#FFFFFF';
      overlayCtx.fillText(labelText, x1 + 4, y1 - 5);
    }

    // Store delete button coordinates for click detection (always store for hover detection)
    const deleteButtonSize = 16;
    const deleteX = x2 - deleteButtonSize - 2;
    const deleteY = y1 + 2;

    roi._deleteButton = {
      x: deleteX,
      y: deleteY,
      width: deleteButtonSize,
      height: deleteButtonSize
    };

    // Draw delete button only if this ROI is being hovered
    if (hoveredRoiIndex === index) {
      // Draw delete button background
      overlayCtx.fillStyle = 'rgba(255, 0, 0, 0.9)';
      overlayCtx.fillRect(deleteX, deleteY, deleteButtonSize, deleteButtonSize);

      // Draw delete button border
      overlayCtx.strokeStyle = '#FFFFFF';
      overlayCtx.lineWidth = 1;
      overlayCtx.strokeRect(deleteX, deleteY, deleteButtonSize, deleteButtonSize);

      // Draw X symbol
      overlayCtx.strokeStyle = '#FFFFFF';
      overlayCtx.lineWidth = 1.5;
      overlayCtx.beginPath();
      overlayCtx.moveTo(deleteX + 3, deleteY + 3);
      overlayCtx.lineTo(deleteX + deleteButtonSize - 3, deleteY + deleteButtonSize - 3);
      overlayCtx.moveTo(deleteX + deleteButtonSize - 3, deleteY + 3);
      overlayCtx.lineTo(deleteX + 3, deleteY + deleteButtonSize - 3);
      overlayCtx.stroke();
    }
  });

  overlayCtx.restore();
}

/**
 * OPTION A: Draw user ROIs in fixed canvas coordinate system
 * Context already has zoom/pan applied, so draw at image pixel coordinates
 */
function drawUserRoisFixed() {
  if (userDrawnRois.length === 0) return;

  overlayCtx.save();

  // Font size relative to current zoom
  const fontSize = 13 / (transform.scale * currentZoomLevel);
  overlayCtx.font = `bold ${fontSize}px Arial`;

  userDrawnRois.forEach((roi, index) => {
    // Draw directly at image coordinates - context transform handles screen mapping
    const x1 = roi.xmin;
    const y1 = roi.ymin;
    const x2 = roi.xmax;
    const y2 = roi.ymax;

    // Determine if this ROI is being hovered
    const isHovered = hoveredRoiIndex === index;

    // Line width relative to zoom
    const lineWidth = (isHovered ? 4 : 3) / (transform.scale * currentZoomLevel);

    // Use bright, visible colors
    if (isHovered) {
      overlayCtx.strokeStyle = '#FF8C00';
      overlayCtx.lineWidth = lineWidth;
      overlayCtx.fillStyle = 'rgba(255, 140, 0, 0.25)';
      overlayCtx.shadowColor = '#FF8C00';
      overlayCtx.shadowBlur = 8 / (transform.scale * currentZoomLevel);
    } else {
      overlayCtx.strokeStyle = '#00FFFF';
      overlayCtx.lineWidth = lineWidth;
      overlayCtx.fillStyle = 'rgba(0, 255, 255, 0.15)';
      overlayCtx.shadowBlur = 0;
    }

    // Draw rectangle
    overlayCtx.fillRect(x1, y1, x2 - x1, y2 - y1);
    overlayCtx.strokeRect(x1, y1, x2 - x1, y2 - y1);

    // Draw label
    if (roi.label) {
      const labelText = `${index + 1}: ${roi.label}`;
      const textMetrics = overlayCtx.measureText(labelText);
      const textWidth = textMetrics.width;
      const textHeight = fontSize;

      overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      overlayCtx.fillRect(x1, y1 - textHeight - 2, textWidth + 8, textHeight + 4);
      overlayCtx.fillStyle = '#FFFFFF';
      overlayCtx.fillText(labelText, x1 + 4, y1 - 5);
    }
  });

  overlayCtx.restore();
}

/**
 * OPTION A: Draw AI detection boxes in fixed canvas coordinate system
 * Context already has zoom/pan applied, so draw at image pixel coordinates
 */
function drawLabeledBoxesFixed(ctx, boxes) {
  if (!boxes || !boxes.length) return;

  for (const b of boxes) {
    const { colorForLabel, formatLabel } = window.__overlayAdapters || {};
    if (!colorForLabel || !formatLabel) {
      console.warn('⚠️ overlayAdapters utilities not available');
      return;
    }

    const color = colorForLabel(b.label);

    // Draw directly at image coordinates - context transform handles screen mapping
    const x1 = b.x;
    const y1 = b.y;
    const w = b.w;
    const h = b.h;

    // Line width relative to zoom
    const lineWidth = 3 / (transform.scale * currentZoomLevel);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.shadowColor = color;
    ctx.shadowBlur = 3 / (transform.scale * currentZoomLevel);
    ctx.strokeRect(x1, y1, w, h);

    // Label
    const text = formatLabel(b.label, b.score);
    const fontSize = 12 / (transform.scale * currentZoomLevel);
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    const pad = 2 / (transform.scale * currentZoomLevel);
    const tw = ctx.measureText(text).width + pad * 2;
    const th = fontSize + pad * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x1, y1 - th, tw, th);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, x1 + pad, y1 - pad);
    ctx.restore();
  }
}

/**
 * Draw user ROIs using unified transform (canvas context-based)
 * This is called from renderOverlays which has already applied the transform
 */
function drawUserRoisTransformed() {
  if (userDrawnRois.length === 0) return;

  overlayCtx.save();
  overlayCtx.font = `bold ${13 / transform.scale}px Arial`;

  userDrawnRois.forEach((roi, index) => {
    // Since context is already transformed, use image coordinates directly
    const x1 = roi.xmin;
    const y1 = roi.ymin;
    const x2 = roi.xmax;
    const y2 = roi.ymax;

    // Determine if this ROI is being hovered
    const isHovered = hoveredRoiIndex === index;

    // Use bright, visible colors for manual ROIs
    if (isHovered) {
      // Bright yellow-orange for hover
      overlayCtx.strokeStyle = '#FF8C00';
      overlayCtx.lineWidth = 4 / transform.scale;
      overlayCtx.fillStyle = 'rgba(255, 140, 0, 0.25)';
      overlayCtx.shadowColor = '#FF8C00';
      overlayCtx.shadowBlur = 8 / transform.scale;
    } else {
      // Bright cyan for normal state
      overlayCtx.strokeStyle = '#00FFFF';
      overlayCtx.lineWidth = 3 / transform.scale;
      overlayCtx.fillStyle = 'rgba(0, 255, 255, 0.15)';
      overlayCtx.shadowBlur = 0;
    }

    // Draw rectangle
    overlayCtx.fillRect(x1, y1, x2 - x1, y2 - y1);
    overlayCtx.strokeRect(x1, y1, x2 - x1, y2 - y1);

    // Draw label with dark background for better visibility
    if (roi.label) {
      const labelText = `${index + 1}: ${roi.label}`;
      const textMetrics = overlayCtx.measureText(labelText);
      const textWidth = textMetrics.width;
      const textHeight = 15 / transform.scale;

      // Draw dark background rectangle for text
      overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      overlayCtx.fillRect(x1, y1 - textHeight - 2, textWidth + 8, textHeight + 4);

      // Draw white text
      overlayCtx.fillStyle = '#FFFFFF';
      overlayCtx.fillText(labelText, x1 + 4, y1 - 5);
    }

    // Store delete button coordinates for click detection
    const deleteButtonSize = 16 / transform.scale;
    const deleteX = x2 - deleteButtonSize - 2;
    const deleteY = y1 + 2;

    roi._deleteButton = {
      x: deleteX * transform.scale + transform.tx,
      y: deleteY * transform.scale + transform.ty,
      width: deleteButtonSize * transform.scale,
      height: deleteButtonSize * transform.scale
    };

    // Draw delete button only if this ROI is being hovered
    if (hoveredRoiIndex === index) {
      // Draw delete button background
      overlayCtx.fillStyle = 'rgba(255, 0, 0, 0.9)';
      overlayCtx.fillRect(deleteX, deleteY, deleteButtonSize, deleteButtonSize);

      // Draw delete button border
      overlayCtx.strokeStyle = '#FFFFFF';
      overlayCtx.lineWidth = 1 / transform.scale;
      overlayCtx.strokeRect(deleteX, deleteY, deleteButtonSize, deleteButtonSize);

      // Draw X symbol
      overlayCtx.strokeStyle = '#FFFFFF';
      overlayCtx.lineWidth = 1.5 / transform.scale;
      overlayCtx.beginPath();
      overlayCtx.moveTo(deleteX + 3 / transform.scale, deleteY + 3 / transform.scale);
      overlayCtx.lineTo(deleteX + deleteButtonSize - 3 / transform.scale, deleteY + deleteButtonSize - 3 / transform.scale);
      overlayCtx.moveTo(deleteX + deleteButtonSize - 3 / transform.scale, deleteY + 3 / transform.scale);
      overlayCtx.lineTo(deleteX + 3 / transform.scale, deleteY + deleteButtonSize - 3 / transform.scale);
      overlayCtx.stroke();
    }
  });

  overlayCtx.restore();
}

/**
 * Draw AI detection boxes using unified transform (canvas context-based)
 * This is called from renderOverlays which has already applied the transform
 */
function drawLabeledBoxesTransformed() {
  if (!lastBoxes || !lastBoxes.length) return;

  const { colorForLabel, formatLabel } = window.__overlayAdapters || {};
  if (!colorForLabel || !formatLabel) {
    console.warn('⚠️ overlayAdapters utilities not available');
    return;
  }

  for (const b of lastBoxes) {
    const color = colorForLabel(b.label);

    // Since context is already transformed, use image coordinates directly
    const x1 = b.x;
    const y1 = b.y;
    const w = b.w;
    const h = b.h;

    // Box with better visibility
    overlayCtx.save();
    overlayCtx.strokeStyle = color;
    overlayCtx.lineWidth = Math.max(2, 3) / transform.scale;
    overlayCtx.shadowColor = color;
    overlayCtx.shadowBlur = 3 / transform.scale;
    overlayCtx.strokeRect(x1, y1, w, h);

    // Label (with tiny background for readability)
    const text = formatLabel(b.label, b.score);
    overlayCtx.font = `${Math.max(12, Math.floor(12))}px system-ui, sans-serif`;
    const pad = 2 / transform.scale;
    const tw = overlayCtx.measureText(text).width + pad * 2;
    const th = 14 / transform.scale + pad * 2;
    overlayCtx.fillStyle = 'rgba(0,0,0,0.55)';
    overlayCtx.fillRect(x1, y1 - th, tw, th);
    overlayCtx.fillStyle = '#fff';
    overlayCtx.fillText(text, x1 + pad, y1 - pad);
    overlayCtx.restore();
  }
}

/**
 * Recalculate transform based on current zoom level and pan values
 * This is called whenever zoom or pan changes to ensure ROI positioning stays correct
 */
function recalculateTransform() {
  if (!currentImageDimensions || !currentImageDimensions.width) {
    console.warn('⚠️ recalculateTransform: image dimensions not set');
    return;
  }

  // Get container dimensions
  const { width: containerWidthRaw, height: containerHeightRaw } = getCanvasContainerSize();
  const containerWidth = Math.round(containerWidthRaw);
  const containerHeight = Math.round(containerHeightRaw);

  if (containerWidth === 0 || containerHeight === 0) {
    console.warn('⚠️ recalculateTransform: container has zero size');
    return;
  }

  const imageWidth = currentImageDimensions.width;
  const imageHeight = currentImageDimensions.height;

  // Base scale (fit to window at zoom 1.0)
  const baseScale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);

  // Apply zoom multiplier
  const scale = baseScale * currentZoomLevel;

  // Calculate scaled dimensions
  const scaledWidth = imageWidth * scale;
  const scaledHeight = imageHeight * scale;

  // Calculate center offset for scaling around image center
  const imageRatio = imageWidth / imageHeight;
  const containerRatio = containerWidth / containerHeight;

  // Start with base centering
  let tx = (containerWidth - scaledWidth) / 2;
  let ty = (containerHeight - scaledHeight) / 2;

  // Apply pan offsets (limited to prevent dragging too far)
  const maxPanX = Math.abs(scaledWidth - containerWidth) / 2;
  const maxPanY = Math.abs(scaledHeight - containerHeight) / 2;

  if (scaledWidth > containerWidth) {
    tx += Math.max(-maxPanX, Math.min(maxPanX, panX));
  }
  if (scaledHeight > containerHeight) {
    ty += Math.max(-maxPanY, Math.min(maxPanY, panY));
  }

  transform.scale = scale;
  transform.tx = tx;
  transform.ty = ty;

  console.log('🔍 Transform recalculated:', {
    zoomLevel: currentZoomLevel,
    baseScale,
    finalScale: scale,
    pan: { panX, panY },
    transform,
    containerSize: { width: containerWidth, height: containerHeight },
    imageSize: { width: imageWidth, height: imageHeight }
  });
}

/**
 * Handle zoom events (wheel scroll or pinch)
 * @param {number} deltaZoom - Change in zoom level
 * @param {number} clientX - Mouse/touch X coordinate (optional, for zoom center)
 * @param {number} clientY - Mouse/touch Y coordinate (optional, for zoom center)
 */
function handleZoom(deltaZoom, clientX, clientY) {
  // Constrain zoom between 0.5x and 5x
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 5.0;
  const oldZoom = currentZoomLevel;

  currentZoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoomLevel + deltaZoom));

  if (currentZoomLevel === oldZoom) {
    return; // No change
  }

  // If we have client coordinates, try to zoom around that point
  if (clientX !== undefined && clientY !== undefined) {
    const rect = overlayCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Convert screen coords to image coords at old zoom
    const imageX = (x - transform.tx) / transform.scale;
    const imageY = (y - transform.ty) / transform.scale;

    recalculateTransform();

    // Calculate new screen position of the same image point
    const newScreenX = imageX * transform.scale + transform.tx;
    const newScreenY = imageY * transform.scale + transform.ty;

    // Adjust pan to keep the point at the same screen position.  We add the
    // full pixel difference rather than dividing by the zoom ratio.  Dividing
    // by the zoom ratio under‑translated the image, leading to misalignment
    // between the image and detection boxes when zooming.  Instead, apply
    // the entire difference; recalculateTransform() will clamp the result.
    panX += (x - newScreenX);
    panY += (y - newScreenY);
  }

  recalculateTransform();
  renderImageCanvas();
  renderOverlays();

  console.log('🔍 Zoom updated:', {
    oldZoom,
    newZoom: currentZoomLevel,
    zoomChange: currentZoomLevel - oldZoom,
    pan: { panX, panY }
  });
}

/**
 * Setup zoom and pan handlers (wheel, pinch, etc.)
 */
function setupZoomHandlers() {
  if (!overlayCanvas) return;

  // Wheel zoom (mouse scroll)
  overlayCanvas.addEventListener('wheel', (e) => {
    if (!currentImageObject) return; // Only zoom if image is loaded

    e.preventDefault();

    // Scroll up = zoom in (positive), down = zoom out (negative)
    const zoomDelta = e.deltaY < 0 ? 0.1 : -0.1;
    handleZoom(zoomDelta, e.clientX, e.clientY);
  }, { passive: false });

  // Touch pinch zoom
  overlayCanvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
    }
  }, { passive: false });

  overlayCanvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && lastTouchDistance > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const currentDistance = Math.sqrt(dx * dx + dy * dy);
      const distanceDelta = currentDistance - lastTouchDistance;

      // Pinch sensitivity: 100px of pinch = 0.2 zoom change
      const zoomDelta = distanceDelta / 500;
      handleZoom(zoomDelta);

      lastTouchDistance = currentDistance;
    }
  }, { passive: false });

  overlayCanvas.addEventListener('touchend', () => {
    lastTouchDistance = 0;
  }, { passive: false });
}

// Setup drag and drop
setupDragAndDrop();

// Setup drawing mode
setupDrawingMode();

// Setup zoom and pan handlers
setupZoomHandlers();

// Setup responsive features
function setupResponsiveFeatures() {
  // Add resize listener for canvas
  window.addEventListener('resize', debouncedResize);

  // Use ResizeObserver to detect when the viewer container changes size
  // This catches layout changes from CSS media queries that window.resize might miss
  const viewer = document.getElementById('viewer');
  if (viewer && window.ResizeObserver) {
    const resizeObserver = new ResizeObserver(() => {
      debouncedResize();
    });
    resizeObserver.observe(viewer);
  }

  // Add orientation change listener for mobile devices
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      debouncedResize();
      // Also trigger NiiVue resize if available
      if (nv && typeof nv.resize === 'function') {
        nv.resize();
      }
    }, 500); // Delay to allow orientation change to complete
  });

  // Setup touch events for better mobile interaction
  if (glCanvas) {
    // Prevent default touch behaviors that might interfere with canvas
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

  // Handle viewport changes (like mobile keyboard appearing)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', debouncedResize);
  }
}

function downloadImageWithOverlays() {
  try {
    setStatus('Preparing download...');

    // Create a temporary canvas to combine the image and overlays
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    // Get the original image dimensions
    const img = new Image();
    img.onload = function() {
      // Set canvas size to match the original image
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;

      // Draw the original image
      tempCtx.drawImage(img, 0, 0);

      // Calculate scale factors to convert overlay coordinates to image coordinates
      const scaleX = img.width / overlayCanvas.width;
      const scaleY = img.height / overlayCanvas.height;

      // Draw user-drawn ROIs
      if (showUserDrawnRois && userDrawnRois.length > 0) {
        tempCtx.save();
        tempCtx.strokeStyle = '#00FFFF';
        tempCtx.lineWidth = 3;
        tempCtx.fillStyle = 'rgba(0, 255, 255, 0.15)';
        tempCtx.font = 'bold 16px Arial';

        userDrawnRois.forEach((roi, index) => {
          const x1 = roi.xmin * scaleX;
          const y1 = roi.ymin * scaleY;
          const x2 = roi.xmax * scaleX;
          const y2 = roi.ymax * scaleY;

          // Draw rectangle
          tempCtx.fillRect(x1, y1, x2 - x1, y2 - y1);
          tempCtx.strokeRect(x1, y1, x2 - x1, y2 - y1);

          // Draw label
          if (roi.label) {
            const labelText = `${index + 1}: ${roi.label}`;
            const textMetrics = tempCtx.measureText(labelText);
            const textWidth = textMetrics.width;
            const textHeight = 20;

            // Draw dark background rectangle for text
            tempCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            tempCtx.fillRect(x1, y1 - textHeight - 2, textWidth + 8, textHeight + 4);

            // Draw white text
            tempCtx.fillStyle = '#FFFFFF';
            tempCtx.fillText(labelText, x1 + 4, y1 - 5);
          }
        });
        tempCtx.restore();
      }

      // Draw AI detection boxes
      if (showAIDetections && lastBoxes.length > 0) {
        tempCtx.save();
        tempCtx.strokeStyle = '#FF6B6B';
        tempCtx.lineWidth = 3;
        tempCtx.fillStyle = 'rgba(255, 107, 107, 0.1)';
        tempCtx.font = 'bold 16px Arial';

        lastBoxes.forEach((box, index) => {
          // AI boxes use x, y, w, h format (not xmin, ymin, xmax, ymax)
          const x1 = box.x * scaleX;
          const y1 = box.y * scaleY;
          const x2 = (box.x + box.w) * scaleX;
          const y2 = (box.y + box.h) * scaleY;

          // Draw rectangle
          tempCtx.fillStyle = 'rgba(255, 107, 107, 0.1)';
          tempCtx.fillRect(x1, y1, x2 - x1, y2 - y1);
          tempCtx.strokeRect(x1, y1, x2 - x1, y2 - y1);

          // Draw label
          if (box.label) {
            const labelText = `AI ${index + 1}: ${box.label} (${Math.round((box.score || 0) * 100)}%)`;
            const textMetrics = tempCtx.measureText(labelText);
            const textWidth = textMetrics.width;
            const textHeight = 20;

            // Draw dark background rectangle for text
            tempCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            tempCtx.fillRect(x1, y1 - textHeight - 2, textWidth + 8, textHeight + 4);

            // Draw white text
            tempCtx.fillStyle = '#FFFFFF';
            tempCtx.fillText(labelText, x1 + 4, y1 - 5);
          }
        });
        tempCtx.restore();
      }

      // Convert canvas to blob and download
      tempCanvas.toBlob(function(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cervical-analysis-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setStatus('Image downloaded successfully');
      }, 'image/png');
    };

    // Use the current image source
    if (currentImageFile) {
      // For uploaded images, create object URL
      const reader = new FileReader();
      reader.onload = function(e) {
        img.src = e.target.result;
      };
      reader.readAsDataURL(currentImageFile);
    } else if (currentSlideUri) {
      // For case images, use the URI
      img.src = resolveUri(currentSlideUri);
    } else {
      setStatus('No image loaded to download');
      return;
    }

  } catch (error) {
    console.error('Download failed:', error);
    setStatus('Download failed: ' + error.message);
  }
}

// Initialize responsive features
setupResponsiveFeatures();

// Defer initial load until after page layout
// This ensures the canvas has proper dimensions from the flex container
setTimeout(() => {
  // Update canvas size to ensure proper dimensions
  updateCanvasSize();

  // Load initial case
  loadCaseFromUrl().catch(e => {
    console.error('Failed to load initial case:', e);
    setStatus('error');
    showSpinner(false);
  });
}, 100);
