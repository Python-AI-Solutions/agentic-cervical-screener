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

const glCanvas     = document.getElementById('glCanvas');
const overlayCanvas= document.getElementById('overlayCanvas');
const overlayCtx   = overlayCanvas.getContext('2d');

overlayCanvas.style.zIndex = '10';

const transform = { scale:1, tx:0, ty:0 };
let nv=null, rois=[], roiIdx=-1, currentSlideId=null, currentSlideUri=null, lastLoadedCase=null;
let layerCache = new Map();          // layer_id -> FeatureCollection (for rects/points)
let visibleLayers = new Set();       // layer_ids currently shown
let lastBoxes = [];                  // boxes from last classify

function setStatus(s){ statusEl.textContent=s; }
function showSpinner(v){ spinnerEl.hidden = !v; }
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
    img.onload = () => { displayImageOnCanvas(img); fitOverlayToImage(img.width, img.height); renderOverlays(); };
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

  setStatus('ready'); showSpinner(false);
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
  // redraw last classifier boxes on top
  drawLabeledBoxes(overlayCtx, lastBoxes, transform);
}

btnLoadDemo.addEventListener('click', ()=> loadCaseFromUrl());
btnLoadCase.addEventListener('click', ()=>{ const url=(caseUrlInput.value||'').trim(); if(url) loadCaseFromUrl(url); });

btnClassify.addEventListener('click', async ()=>{
  try {
    setStatus('classifying…'); showSpinner(true); btnClassify.disabled = true;
    const res=await classify(currentSlideId, currentSlideUri);
    lastBoxes = res.boxes || [];
    renderOverlays();
    setStatus('classified');
  } catch(e){ console.error(e); setStatus('error'); }
  finally { showSpinner(false); btnClassify.disabled = false; }
});

btnPrevRoi.addEventListener('click', ()=>{ if(!rois.length) return; roiIdx=(roiIdx-1+rois.length)%rois.length; highlight(rois[roiIdx]); });
btnNextRoi.addEventListener('click', ()=>{ if(!rois.length) return; roiIdx=(roiIdx+1)%rois.length; highlight(rois[roiIdx]); });

function highlight(roi){
  overlayCtx.save(); overlayCtx.strokeStyle='#22C55E'; overlayCtx.lineWidth=4*transform.scale;
  const x1=roi.xmin*transform.scale+transform.tx, y1=roi.ymin*transform.scale+transform.ty;
  const x2=roi.xmax*transform.scale+transform.tx, y2=roi.ymax*transform.scale+transform.ty;
  overlayCtx.strokeRect(x1,y1,x2-x1,y2-y1); overlayCtx.restore(); setStatus(`ROI ${(roiIdx+1)}/${rois.length}`);
}

// initial load
loadCaseFromUrl().catch(e=>{ console.error(e); setStatus('error'); showSpinner(false); });
