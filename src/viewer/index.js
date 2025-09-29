import { fetchCase, resolveUri } from '../api/cqaiClient.js';
import { classify } from '../api/classifyClient.js?v=3';
import { addLayerToNiivue, drawLabeledBoxes, drawGeoJSON } from './overlayAdapters.js';
import { collectRois } from './roiNav.js';

const statusEl     = document.getElementById('status');
const spinnerEl    = document.getElementById('spinner');
const layersEl     = document.getElementById('layers');
const btnLoadCase  = document.getElementById('btnLoadCase');
const btnClassify  = document.getElementById('btnClassify');
const caseUrlInput = document.getElementById('caseUrl');
const btnPrevRoi   = document.getElementById('btnPrevRoi');
const btnNextRoi   = document.getElementById('btnNextRoi');
const btnToggleRoiMode = document.getElementById('btnToggleRoiMode');

const glCanvas     = document.getElementById('glCanvas');
const overlayCanvas= document.getElementById('overlayCanvas');
const overlayCtx   = overlayCanvas.getContext('2d');

overlayCanvas.style.zIndex = '10';

const transform = { scale:1, tx:0, ty:0 };
let nv=null, rois=[], roiIdx=-1, currentSlideId=null, currentSlideUri=null, lastLoadedCase=null;
let layerCache = new Map();          // layer_id -> FeatureCollection (for rects/points)
let visibleLayers = new Set();       // layer_ids currently shown
let lastBoxes = [];                  // boxes from last classify
let roiMode = 'ground_truth';        // 'ground_truth' or 'ai_detections'
let showAIDetections = true;         // Whether to show AI classification boxes

// Drawing mode variables
let isDrawing = false;
let drawingStart = null;
let drawingRect = null;
let userDrawnRois = [];              // User-drawn rectangles
let showUserDrawnRois = true;        // Toggle for user-drawn rectangles visibility
let currentImageFile = null;         // Store the current image file for classification

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
function fitOverlayToImage(w,h){
  const boxW=glCanvas.clientWidth, boxH=glCanvas.clientHeight;
  const scale=Math.min(boxW/w, boxH/h), tx=(boxW-w*scale)/2, ty=(boxH-h*scale)/2;
  glCanvas.width=boxW; glCanvas.height=boxH; overlayCanvas.width=boxW; overlayCanvas.height=boxH;
  overlayCanvas.style.width=boxW+'px'; overlayCanvas.style.height=boxH+'px';
  transform.scale=scale; transform.tx=tx; transform.ty=ty;
}

// Responsive canvas resizing
function handleCanvasResize() {
  if (glCanvas && overlayCanvas) {
    const rect = glCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Set canvas size to match display size
    glCanvas.width = rect.width * dpr;
    glCanvas.height = rect.height * dpr;
    overlayCanvas.width = rect.width * dpr;
    overlayCanvas.height = rect.height * dpr;

    // Scale canvas back down using CSS
    glCanvas.style.width = rect.width + 'px';
    glCanvas.style.height = rect.height + 'px';
    overlayCanvas.style.width = rect.width + 'px';
    overlayCanvas.style.height = rect.height + 'px';

    // Scale the drawing context so everything draws at the correct size
    const ctx = glCanvas.getContext('2d');
    const overlayCtx = overlayCanvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
    if (overlayCtx) overlayCtx.scale(dpr, dpr);

    // Re-render overlays if they exist
    if (lastBoxes.length > 0 || layerCache.size > 0) {
      renderOverlays();
    }
  }
}

// Debounced resize handler
let resizeTimeout;
function debouncedResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(handleCanvasResize, 100);
}

function displayImageOnCanvas(img) {
  // Hide the drop zone when image is loaded
  const dropZone = document.getElementById('dropZone');
  if (dropZone) {
    dropZone.style.display = 'none';
  }

  let imageCanvas = document.getElementById('imageCanvas');
  if (!imageCanvas) {
    imageCanvas = document.createElement('canvas');
    imageCanvas.id = 'imageCanvas';
    imageCanvas.style.position = 'absolute';
    imageCanvas.style.top = '0';
    imageCanvas.style.left = '0';
    imageCanvas.style.width = '100%';
    imageCanvas.style.height = '100%';
    imageCanvas.style.zIndex = '5';
    glCanvas.parentNode.insertBefore(imageCanvas, overlayCanvas);
  }
  const boxW = glCanvas.clientWidth, boxH = glCanvas.clientHeight;
  imageCanvas.width = boxW; imageCanvas.height = boxH;
  const ctx = imageCanvas.getContext('2d');
  ctx.clearRect(0,0,boxW,boxH);
  const scale = Math.min(boxW/img.width, boxH/img.height);
  const width = img.width * scale, height = img.height * scale;
  const x = (boxW - width) / 2, y = (boxH - height) / 2;
  ctx.drawImage(img, x, y, width, height);
}

async function loadCaseFromUrl(url){
  setStatus('loading…'); showSpinner(true);
  layersEl.innerHTML=''; overlayCtx.clearRect(0,0,overlayCanvas.width,overlayCanvas.height);
  rois=[]; roiIdx=-1; layerCache.clear(); visibleLayers.clear(); lastBoxes = [];
  userDrawnRois = []; // Clear user-drawn ROIs
  currentImageFile = null; // Clear current image file
  showAIDetections = true; // Reset AI detections visibility

  // Show drop zone when loading new case
  const dropZone = document.getElementById('dropZone');
  if (dropZone) {
    dropZone.style.display = 'block';
  }

  const NvCtor = window.Niivue || (window.niivue && window.niivue.Niivue);
  if (!NvCtor) throw new Error('Niivue not loaded');
  nv = new NvCtor({ isResizeCanvas:false }); await nv.attachTo('glCanvas');

  let doc=null;
  if (url){ const r=await fetch(url, { cache:'no-store' }); if(!r.ok) throw new Error('case json fetch failed'); doc=await r.json(); }
  else { doc=await fetchCase(); }
  lastLoadedCase=doc;
  const slide=doc.slides?.[0]; if(!slide) throw new Error('no slides');
  currentSlideId=slide.slide_id||'SLIDE-001'; currentSlideUri=slide.uri;

  const imgUrl=resolveUri(slide.uri);
  if (/\.(png|jpg|jpeg)$/i.test(imgUrl)) {
    const img = new Image();
    img.onload = () => {
      displayImageOnCanvas(img);
      fitOverlayToImage(img.width, img.height);
      renderOverlays();
      setStatus('ready');
      showSpinner(false);
    };
    img.onerror = () => { console.error('Failed to load image:', imgUrl); setStatus('error loading image'); showSpinner(false); };
    img.src = imgUrl;
  } else {
    try {
      await nv.loadImages([{ url: imgUrl, name:'slide', colormap:'gray', opacity:1 }]);
      const img = new Image(); img.onload=()=>{ fitOverlayToImage(img.width, img.height); renderOverlays(); }; img.src=imgUrl;
    } catch (error) {
      console.warn('unsupported image format for demo:', imgUrl, error);
      fitOverlayToImage(1024,1024); renderOverlays();
    }
  }

  // Add user-drawn ROIs toggle
  addUserDrawnRoisToggle();

  // Build layer controls + prefetch & cache
  (slide.layers||[]).forEach(async (L)=>{
    // UI
    const el=document.createElement('div'); el.className='layer';
    el.innerHTML = `
      <span>${L.layer_id} <span class="muted">(${L.geometry})</span></span>
      <label><input type="checkbox" data-layer="${L.layer_id}" checked/> Show</label>`;
    layersEl.appendChild(el);
    visibleLayers.add(L.layer_id);

    // Listen for changes
    const cb = el.querySelector('input[type="checkbox"]');
    cb.addEventListener('change', () => {
      cb.checked ? visibleLayers.add(L.layer_id) : visibleLayers.delete(L.layer_id);
      renderOverlays();
    });

    // Cache data (rects/points/polygons) - but don't display them
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

  // Note: setStatus('ready') and showSpinner(false) are now called in img.onload for PNG images
  // For medical formats, they're still called here
  if (!/\.(png|jpg|jpeg)$/i.test(imgUrl)) {
    setStatus('ready'); showSpinner(false);
  }
}

function renderOverlays(){
  console.log('🎨 renderOverlays called:', { showUserDrawnRois, showAIDetections, roiMode, lastBoxesLength: lastBoxes.length });
  overlayCtx.clearRect(0,0,overlayCanvas.width,overlayCanvas.height);

  // Only show user-drawn ROIs (no hardcoded detections)
  if (showUserDrawnRois) {
    console.log('🎨 Drawing user-drawn ROIs');
    drawUserRois();
  }

  // Show AI detection boxes only if enabled and in AI mode
  if (showAIDetections && roiMode === 'ai_detections') {
    console.log('🎨 Drawing AI detection boxes');
    drawLabeledBoxes(overlayCtx, lastBoxes, transform);
  } else {
    console.log('🎨 Not drawing AI boxes:', { showAIDetections, roiMode });
  }
}

function addAIDetectionsToggle() {
  // Check if AI detections toggle already exists
  if (document.querySelector('[data-layer="ai-detections"]')) return;

  // Create AI detections toggle
  const el = document.createElement('div');
  el.className = 'layer';
  el.innerHTML = `
    <span>ai-detections <span class="muted">(rects)</span></span>
    <label><input type="checkbox" data-layer="ai-detections" checked/> Show</label>`;

  layersEl.appendChild(el);

  // Add event listener
  const cb = el.querySelector('input[type="checkbox"]');
  cb.addEventListener('change', () => {
    showAIDetections = cb.checked;
    renderOverlays();
  });
}

function addUserDrawnRoisToggle() {
  // Check if user-drawn ROIs toggle already exists
  if (document.querySelector('[data-layer="user-drawn-rois"]')) return;

  // Create user-drawn ROIs toggle
  const el = document.createElement('div');
  el.className = 'layer';
  el.innerHTML = `
    <span>user-drawn-rois <span class="muted">(rects)</span></span>
    <label><input type="checkbox" data-layer="user-drawn-rois" checked/> Show</label>`;

  layersEl.appendChild(el);

  // Add event listener
  const cb = el.querySelector('input[type="checkbox"]');
  cb.addEventListener('change', () => {
    showUserDrawnRois = cb.checked;
    renderOverlays();
  });
}

btnLoadCase.addEventListener('click', ()=>{ const url=(caseUrlInput.value||'').trim(); if(url) loadCaseFromUrl(url); });

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
    console.log('🔍 lastBoxes set to:', lastBoxes);

    // Add AI detections toggle if it doesn't exist
    addAIDetectionsToggle();

    renderOverlays();
    setStatus(`classified - ${lastBoxes.length} detections found`);
  } catch(e){
    console.error('❌ Classification error:', e);
    setStatus('classification failed: ' + e.message);
  }
  finally { showSpinner(false); btnClassify.disabled = false; }
});

btnPrevRoi.addEventListener('click', ()=>{
  const currentRois = getCurrentRois();
  if(!currentRois.length) return;
  roiIdx=(roiIdx-1+currentRois.length)%currentRois.length;
  highlight(currentRois[roiIdx]);
});

btnNextRoi.addEventListener('click', ()=>{
  const currentRois = getCurrentRois();
  if(!currentRois.length) return;
  roiIdx=(roiIdx+1)%currentRois.length;
  highlight(currentRois[roiIdx]);
});

btnToggleRoiMode.addEventListener('click', ()=>{
  // Toggle between ground truth and AI detections
  roiMode = roiMode === 'ground_truth' ? 'ai_detections' : 'ground_truth';
  roiIdx = -1; // Reset ROI index

  // Update button text and style
  if (roiMode === 'ai_detections') {
    btnToggleRoiMode.textContent = 'AI Detections';
    btnToggleRoiMode.style.background = '#DC2626'; // Red for AI
    overlayCanvas.style.cursor = 'default';
  } else {
    btnToggleRoiMode.textContent = 'Ground Truth';
    btnToggleRoiMode.style.background = '#374151'; // Gray for ground truth
    overlayCanvas.style.cursor = 'crosshair';
  }

  // Clear any existing highlights
  renderOverlays();
  setStatus(`Switched to ${roiMode === 'ai_detections' ? 'AI Detections' : 'Ground Truth'} navigation`);
});

function getCurrentRois() {
  if (roiMode === 'ai_detections' && lastBoxes.length > 0) {
    // Convert AI detection boxes to ROI format
    return lastBoxes.map(box => ({
      xmin: box.x,
      ymin: box.y,
      xmax: box.x + box.w,
      ymax: box.y + box.h,
      label: box.label,
      score: box.score
    }));
  }
  // In ground truth mode, use user-drawn ROIs if available, otherwise use loaded ROIs
  return userDrawnRois.length > 0 ? userDrawnRois : rois;
}

function highlight(roi){
  // Redraw all overlays first to clear previous highlights
  renderOverlays();

  const currentRois = getCurrentRois();
  const isAI = roiMode === 'ai_detections';

  // Then draw the highlight on top
  overlayCtx.save();
  overlayCtx.strokeStyle = isAI ? '#FFD700' : '#22C55E'; // Gold for AI, Green for ground truth
  overlayCtx.lineWidth=4*transform.scale;
  overlayCtx.setLineDash([8, 4]); // Dashed line to make it more visible

  const x1=roi.xmin*transform.scale+transform.tx, y1=roi.ymin*transform.scale+transform.ty;
  const x2=roi.xmax*transform.scale+transform.tx, y2=roi.ymax*transform.scale+transform.ty;
  overlayCtx.strokeRect(x1,y1,x2-x1,y2-y1);

  overlayCtx.restore();

  // Show different status for AI vs ground truth
  if (isAI && roi.label && roi.score) {
    setStatus(`AI Detection ${(roiIdx+1)}/${currentRois.length}: ${roi.label} (${Math.round(roi.score*100)}%)`);
  } else if (roi.label) {
    setStatus(`ROI ${(roiIdx+1)}/${currentRois.length}: ${roi.label}`);
  } else {
    setStatus(`ROI ${(roiIdx+1)}/${currentRois.length} - Ground Truth`);
  }
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
        layersEl.innerHTML = '';
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        layerCache.clear();
        visibleLayers.clear();
        lastBoxes = [];
        rois = [];
        roiIdx = -1;
        userDrawnRois = []; // Clear user-drawn ROIs
        currentImageFile = null; // Clear current image file

        // Display the new image
        displayImageOnCanvas(img);
        fitOverlayToImage(img.width, img.height);

        // Update current slide info
        currentSlideId = `DROPPED-${Date.now()}`;
        currentSlideUri = file.name;
        currentImageFile = file; // Store the file for classification
        console.log('Set currentImageFile:', currentImageFile);

        // Set ROI mode to AI detections for custom images
        roiMode = 'ai_detections';
        console.log('Set roiMode to ai_detections for custom image');

        // Update UI
        setStatus(`${file.name} loaded - ${img.width}×${img.height}px`);
        showSpinner(false);

        // Add user-drawn ROIs toggle for dropped images
        addUserDrawnRoisToggle();

        // Add a layer control for the dropped image
        const el = document.createElement('div');
        el.className = 'layer';
        el.innerHTML = `<span>${file.name} <span class="muted">(dropped image)</span></span><label><input type="checkbox" checked disabled/> Show</label>`;
        layersEl.appendChild(el);
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

  // Touch events for mobile
  overlayCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  overlayCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  overlayCanvas.addEventListener('touchend', handleTouchEnd, { passive: false });
}

function handleMouseDown(e) {
  console.log('Mouse down event', { roiMode, isDrawing });
  if (roiMode !== 'ground_truth') {
    console.log('Not in ground truth mode, ignoring');
    return;
  }

  const rect = overlayCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  console.log('Starting drawing at', { x, y });
  startDrawing(x, y);
}

function handleMouseMove(e) {
  if (!isDrawing || roiMode !== 'ground_truth') return;

  const rect = overlayCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  updateDrawing(x, y);
}

function handleMouseUp(e) {
  if (!isDrawing || roiMode !== 'ground_truth') return;

  const rect = overlayCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  finishDrawing(x, y);
}

function handleTouchStart(e) {
  e.preventDefault();
  if (roiMode !== 'ground_truth') return;

  const rect = overlayCanvas.getBoundingClientRect();
  const touch = e.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  startDrawing(x, y);
}

function handleTouchMove(e) {
  e.preventDefault();
  if (!isDrawing || roiMode !== 'ground_truth') return;

  const rect = overlayCanvas.getBoundingClientRect();
  const touch = e.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  updateDrawing(x, y);
}

function handleTouchEnd(e) {
  e.preventDefault();
  if (!isDrawing || roiMode !== 'ground_truth') return;

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
    <h3 style="margin: 0 0 var(--spacing-md) 0; color: var(--text-primary);">Select Label for Rectangle</h3>
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
      <button id="confirmLabel" style="background: #1e40af; color: white; border: 1px solid #1e40af; padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--border-radius); cursor: pointer;">Add Rectangle</button>
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
  overlayCtx.strokeStyle = '#4ECDC4';
  overlayCtx.lineWidth = 2;
  overlayCtx.fillStyle = 'rgba(78, 205, 196, 0.1)';
  overlayCtx.font = 'bold 13px Arial';

  userDrawnRois.forEach((roi, index) => {
    const x1 = roi.xmin * transform.scale + transform.tx;
    const y1 = roi.ymin * transform.scale + transform.ty;
    const x2 = roi.xmax * transform.scale + transform.tx;
    const y2 = roi.ymax * transform.scale + transform.ty;

    // Draw rectangle
    overlayCtx.fillStyle = 'rgba(78, 205, 196, 0.1)';
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
  });

  overlayCtx.restore();
}

// Setup drag and drop
setupDragAndDrop();

// Setup drawing mode
setupDrawingMode();

// Setup responsive features
function setupResponsiveFeatures() {
  // Add resize listener for canvas
  window.addEventListener('resize', debouncedResize);

  // Add orientation change listener for mobile devices
  window.addEventListener('orientationchange', () => {
    setTimeout(handleCanvasResize, 500); // Delay to allow orientation change to complete
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

// Initialize responsive features
setupResponsiveFeatures();

// Ensure spinner is hidden on page load
showSpinner(false);

// initial load
loadCaseFromUrl().catch(e=>{ console.error(e); setStatus('error'); showSpinner(false); });
