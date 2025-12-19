import { runLocalOnnx } from './localOnnx.js?v=9';

const ENV = window.__ENV__ || {};
const API_BASE = ENV.API_BASE || '';
const preferLocal = ENV.IN_BROWSER_INFERENCE !== false; // default true unless explicitly disabled
const hasBackend = typeof API_BASE === 'string' && API_BASE.length > 0;
const useMock = ENV.USE_MOCK === true;

/**
 * Classify an image using in-browser ONNX (primary) with backend fallback.
 * Accepts legacy positional args or an options object.
 */
export async function classify(arg1 = 'SLIDE-001', imageUri = null, imageData = null) {
  const opts = typeof arg1 === 'object'
    ? { slideId: 'SLIDE-001', ...arg1 }
    : { slideId: arg1, imageUri, imageData };

  const { slideId = 'SLIDE-001', imageUri: uri = null, imageData: blob = null, imageElement = null, confThreshold = 0.25 } = opts;
  console.log('classify called with:', { slideId, uri, hasBlob: !!blob, preferLocal, hasBackend, API_BASE });

  // Primary: local ONNX inference (no backend required)
  if (preferLocal) {
    try {
      const result = await runLocalOnnx({
        imageElement,
        imageFile: blob,
        imageUri: uri,
        confThreshold,
      });
      return { slide_id: slideId, boxes: result.boxes || [] };
    } catch (e) {
      console.warn('Local ONNX inference failed, falling back:', e);
      // fall through to mock/backend
    }
  }

  // Optional: explicit mock mode
  if (useMock) {
    const r = await fetch(`cases/classify.json`);
    if (!r.ok) throw new Error('mock classify failed');
    return r.json();
  }

  if (!hasBackend) {
    throw new Error(
      "Local inference failed and no backend is configured (API_BASE is empty). " +
        "Check that onnxruntime-web can load its WASM binaries and that your server sets COOP/COEP headers."
    );
  }

  // Backend fallback: upload if we have a Blob/File
  if (blob) {
    const formData = new FormData();
    formData.append('file', blob);
    formData.append('conf_threshold', `${confThreshold}`);

    const r = await fetch(`${API_BASE}/v1/classify-upload`, {
      method: 'POST',
      body: formData,
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      throw new Error(`classify failed ${r.status} ${t}`);
    }
    const result = await r.json();
    return { slide_id: slideId, boxes: result.boxes || [] };
  }

  // Legacy JSON classify
  const payload = { slide_id: slideId };
  if (uri) payload.image_uri = uri;
  const r = await fetch(`${API_BASE}/v1/classify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`classify failed ${r.status} ${t}`);
  }
  return r.json();
}
