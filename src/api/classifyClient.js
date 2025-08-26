const ENV = window.__ENV__ || {};
const API_BASE = ENV.API_BASE || '';
const useMock = !API_BASE;

export async function classify(slideId='SLIDE-001', imageUri=null) {
  if (useMock) { const r = await fetch('./mock/classify.json'); if(!r.ok) throw new Error('mock classify failed'); return r.json(); }
  const payload = imageUri ? { image_uri: imageUri } : { slide_id: slideId };
  const r = await fetch(`${API_BASE}/v1/classify`, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) });
  if(!r.ok){ const t=await r.text().catch(()=> ''); throw new Error(`classify failed ${r.status} ${t}`); }
  return r.json();
}
