import { fetchCase, resolveUri } from '../api/cqaiClient.js';
import { classify } from '../api/classifyClient.js';
import { addLayerToNiivue, drawLabeledBoxes, drawGeoJSON } from './overlayAdapters.js';
import { collectRois } from './roiNav.js';

const statusEl     = document.getElementById('status');
const spinnerEl    = document.getElementById('spinner');
const layersEl     = document.getElementById('layers');
const btnLoadDemo  = document.getElementById('btnLoadDemo');
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

function displayImageOnCanvas(img) {
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
  showAIDetections = true; // Reset AI detections visibility

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

    // Cache data (rects/points/polygons)
    try {
      const fc = await addLayerToNiivue(nv, L, resolveUri, overlayCtx, transform);
      if (fc) {
        layerCache.set(L.layer_id, { fc, colorKind: L.kind });
        // ROIs: collect from rect-like layers the first time
        if (L.geometry === 'rects' || L.kind === 'roi') {
          try { rois.push(...collectRois(fc)); } catch {}
        }
        renderOverlays(); // ensure it appears even before classify
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
  overlayCtx.clearRect(0,0,overlayCanvas.width,overlayCanvas.height);
  // visible static layers
  for (const [layer_id, obj] of layerCache.entries()) {
    if (!visibleLayers.has(layer_id)) continue;
    // reuse draw function with appropriate color by kind
    // we pass a color per kind using overlayAdapters' internal rules
    drawGeoJSON(overlayCtx, obj.fc, '#00E5FF', transform); // color is recomputed inside fc if you prefer
  }
  // redraw last classifier boxes on top (only if enabled)
  if (showAIDetections) {
    drawLabeledBoxes(overlayCtx, lastBoxes, transform);
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

btnLoadDemo.addEventListener('click', ()=> loadCaseFromUrl());
btnLoadCase.addEventListener('click', ()=>{ const url=(caseUrlInput.value||'').trim(); if(url) loadCaseFromUrl(url); });

btnClassify.addEventListener('click', async ()=>{
  try {
    setStatus('classifying…'); showSpinner(true); btnClassify.disabled = true;
    const res=await classify(currentSlideId, currentSlideUri);
    lastBoxes = res.boxes || [];

    // Add AI detections toggle if it doesn't exist
    addAIDetectionsToggle();

    renderOverlays();
    setStatus('classified');
  } catch(e){ console.error(e); setStatus('error'); }
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
  } else {
    btnToggleRoiMode.textContent = 'Ground Truth';
    btnToggleRoiMode.style.background = '#374151'; // Gray for ground truth
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
  return rois; // ground truth ROIs
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
    setStatus('Drop image here...');
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

        // Display the new image
        displayImageOnCanvas(img);
        fitOverlayToImage(img.width, img.height);

        // Update current slide info
        currentSlideId = `DROPPED-${Date.now()}`;
        currentSlideUri = file.name;

        // Update UI
        setStatus(`${file.name} loaded - ${img.width}×${img.height}px`);
        showSpinner(false);

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

// Setup drag and drop
setupDragAndDrop();

// Ensure spinner is hidden on page load
showSpinner(false);

// initial load
loadCaseFromUrl().catch(e=>{ console.error(e); setStatus('error'); showSpinner(false); });
