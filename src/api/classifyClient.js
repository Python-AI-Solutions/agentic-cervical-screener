const ENV = window.__ENV__ || {};
const API_BASE = ENV.API_BASE || '';
const useMock = !API_BASE;

export async function classify(slideId='SLIDE-001', imageUri=null, imageData=null) {
  console.log('classify called with:', { slideId, imageUri, imageData, useMock, API_BASE });

  if (useMock) {
    console.log('Using mock data because useMock is true');
    const r = await fetch(`${API_BASE}/mock/classify.json`);
    if(!r.ok) throw new Error('mock classify failed');
    return r.json();
  }

  // If we have image data (from user-loaded image), send it as form data
  if (imageData) {
    console.log('🚀 SENDING TO CLASSIFY-UPLOAD ENDPOINT:', { slideId, imageData, API_BASE });
    const formData = new FormData();
    formData.append('file', imageData);
    formData.append('conf_threshold', '0.25');

    console.log('FormData contents:', Array.from(formData.entries()));

    const r = await fetch(`${API_BASE}/v1/classify-upload`, {
      method:'POST',
      body: formData
    });
    console.log('Response status:', r.status, r.statusText);
    if(!r.ok){
      const t=await r.text().catch(()=> '');
      console.error('Upload failed:', t);
      throw new Error(`classify failed ${r.status} ${t}`);
    }
    const result = await r.json();
    console.log('✅ Classification result:', result);
    // Transform the response to match the expected format
    return {
      slide_id: slideId,
      boxes: result.boxes || []
    };
  }

  // For regular cases, send JSON with image_uri
  console.log('⚠️ USING OLD CLASSIFY ENDPOINT (this should not happen for custom images):', { slideId, imageUri, API_BASE });
  const payload = { slide_id: slideId };
  if (imageUri) payload.image_uri = imageUri;
  const r = await fetch(`${API_BASE}/v1/classify`, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) });
  if(!r.ok){ const t=await r.text().catch(()=> ''); throw new Error(`classify failed ${r.status} ${t}`); }
  return r.json();
}
