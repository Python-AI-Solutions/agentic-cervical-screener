// --- color rules -------------------------------------------------------------
const CLASS_COLORS = {
  'HSIL-like': '#FF1493',  // Deep pink - highly visible for high-grade lesions
  'LSIL-like': '#FF6347',  // Tomato red - visible for low-grade lesions
  'Normal':    '#00FF7F',  // Spring green - bright for normal cells
  'Artifact':  '#FFD700',  // Gold - stands out for artifacts
  'ASC-US':    '#FF4500',  // Orange red
  'ASC-H':     '#DC143C',  // Crimson
  'LSIL':      '#FF6347',  // Tomato (same as LSIL-like)
  'HSIL':      '#FF1493',  // Deep pink (same as HSIL-like)
  'SCC':       '#B22222',  // Fire brick - dark red for squamous cell carcinoma
  'Negative for intraepithelial lesion': '#00FF7F',  // Spring green (same as Normal)
};
const LAYER_KIND_COLORS = {
  detections:   '#00E5FF',
  segmentation: '#FF4D4D',
  roi:          '#22C55E',
  lesion_token: '#EF4444',
  tz_evidence:  '#8B5CF6',
  default:      '#00E5FF',
};
export function colorForLabel(label, fallback='#00FF7F') {
  return CLASS_COLORS[label] || fallback;
}
function colorForLayerKind(kind) {
  return LAYER_KIND_COLORS[kind] || LAYER_KIND_COLORS.default;
}

// --- label formatter ---------------------------------------------------------
export function formatLabel(label, score) {
  if (score == null) return label || '';
  // show as percentage (e.g. 92%)
  const pct = Math.round(score * 100);
  return `${label || ''} ${pct}%`.trim();
}

// --- draw helpers ------------------------------------------------------------
export function drawGeoJSON(ctx, fc, color, transform) {
  if (!fc || fc.type !== 'FeatureCollection') return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle   = color + '55';
  ctx.lineWidth   = Math.max(1, 2 * transform.scale);

  for (const f of fc.features || []) {
    const g = f.geometry || {};
    if (g.type === 'Point') {
      const [x, y] = g.coordinates;
      const sx = x * transform.scale + transform.tx;
      const sy = y * transform.scale + transform.ty;

      // Draw larger, more visible point with cross-hair
      const radius = Math.max(8, 12 * transform.scale);

      // Draw filled circle
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw cross-hair for better visibility
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(sx - radius * 1.5, sy);
      ctx.lineTo(sx + radius * 1.5, sy);
      ctx.moveTo(sx, sy - radius * 1.5);
      ctx.lineTo(sx, sy + radius * 1.5);
      ctx.lineWidth = Math.max(2, 3 * transform.scale);
      ctx.stroke();
      ctx.restore();
    } else if (g.type === 'Polygon') {
      for (const ring of g.coordinates || []) {
        ctx.beginPath();
        ring.forEach(([x, y], i) => {
          const sx = x * transform.scale + transform.tx;
          const sy = y * transform.scale + transform.ty;
          i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
        });
        ctx.closePath();
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

export function drawLabeledBoxes(ctx, boxes, transform) {
  if (!boxes || !boxes.length) return;
  console.log('🎨 drawLabeledBoxes called with:', { boxesCount: boxes.length, transform });
  for (const b of boxes) {
    const color = colorForLabel(b.label);
    const x1 = b.x * transform.scale + transform.tx;
    const y1 = b.y * transform.scale + transform.ty;
    const w  = b.w * transform.scale;
    const h  = b.h * transform.scale;

    console.log('🎨 Drawing box:', {
      original: { x: b.x, y: b.y, w: b.w, h: b.h },
      transformed: { x1, y1, w, h },
      transform
    });

    // box with better visibility
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth   = Math.max(2, 3 * transform.scale);
    ctx.shadowColor = color;
    ctx.shadowBlur = 3;
    ctx.strokeRect(x1, y1, w, h);

    // label (with tiny background for readability)
    const text = formatLabel(b.label, b.score);
    ctx.font = `${Math.max(12, Math.floor(12 * transform.scale))}px system-ui, sans-serif`;
    const pad = 2 * transform.scale;
    const tw  = ctx.measureText(text).width + pad * 2;
    const th  = 14 * transform.scale + pad * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x1, y1 - th, tw, th);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, x1 + pad, y1 - pad);
    ctx.restore();
  }
}

// --- layer loader (rects/points/polygons) -----------------------------------
export async function addLayerToNiivue(nv, layer, resolveUri, overlayCtx, transform) {
  const color = colorForLayerKind(layer.kind);
  if (['rects', 'points', 'polygons'].includes(layer.geometry)) {
    const url = resolveUri(layer.uri);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`layer ${layer.layer_id} fetch failed`);
    const fc = await res.json();
    drawGeoJSON(overlayCtx, fc, color, transform);
    return fc; // return for caching
  }
  // masks/raster not implemented in this demo
  return null;
}
