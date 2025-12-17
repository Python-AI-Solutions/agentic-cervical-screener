/* Local ONNX runtime for in-browser inference (CPU/WASM first, WebGPU optional). */
const ENV = window.__ENV__ || {};
// Prefer a relative base so the app can be hosted at a subpath.
const MODEL_BASE = ENV.MODEL_BASE || "model";
const LABELS_URL = ENV.LABELS_URL || `${MODEL_BASE}/labels.json`;
const EXPLICIT_FP32_URL =
  typeof ENV.MODEL_FP32_URL === "string" && ENV.MODEL_FP32_URL.length > 0
    ? ENV.MODEL_FP32_URL
    : null;
const EXPLICIT_INT8_URL =
  typeof ENV.MODEL_INT8_URL === "string" && ENV.MODEL_INT8_URL.length > 0
    ? ENV.MODEL_INT8_URL
    : null;
// Default to FP32 (quantization is currently unreliable for this model graph).
const PREFER_INT8 = ENV.PREFER_INT8 === true;
const ENABLE_INT8 = ENV.ENABLE_INT8 === true || EXPLICIT_INT8_URL !== null;
const FP32_URL = EXPLICIT_FP32_URL || `${MODEL_BASE}/best.onnx`;
const INT8_URL = EXPLICIT_INT8_URL || `${MODEL_BASE}/best.int8.onnx`;
const CANDIDATE_MODELS = (
  PREFER_INT8 && ENABLE_INT8 ? [INT8_URL, FP32_URL] : [FP32_URL, ...(ENABLE_INT8 ? [INT8_URL] : [])]
).filter(Boolean);
const DEFAULT_CONF = typeof ENV.CONF_THRESHOLD === "number" ? ENV.CONF_THRESHOLD : 0.25;
const DEFAULT_CLASS_NAMES = [
  "Negative for intraepithelial lesion",
  "ASC-US",
  "ASC-H",
  "LSIL",
  "HSIL",
  "SCC",
];
const ENABLE_WEBGPU = ENV.ENABLE_WEBGPU === true; // stretch goal, CPU/WASM is default
const DEFAULT_ORT_VERSION = "1.23.2";
const ORT_MJS_URL =
  ENV.ORT_MJS_URL ||
  `https://cdn.jsdelivr.net/npm/onnxruntime-web@${DEFAULT_ORT_VERSION}/dist/ort.min.mjs`;

let ortPromise = null;
let sessionPromise = null;
let sessionInputName = null;
let classNamesPromise = null;

function normalizeClassNames(value) {
  if (!value) return null;
  if (Array.isArray(value) && value.length > 0) {
    const names = value.map((v) => String(v)).filter(Boolean);
    return names.length > 0 ? names : null;
  }
  // Support an object map like {0: "label", 1: "label2"}
  if (typeof value === "object") {
    const entries = Object.entries(value)
      .map(([k, v]) => [Number(k), String(v)])
      .filter(([k, v]) => Number.isFinite(k) && v);
    if (entries.length === 0) return null;
    entries.sort((a, b) => a[0] - b[0]);
    return entries.map(([, v]) => v);
  }
  return null;
}

async function loadClassNames() {
  const envNames = normalizeClassNames(ENV.CLASS_NAMES);
  if (envNames) return envNames;
  if (classNamesPromise) return classNamesPromise;
  classNamesPromise = (async () => {
    try {
      const r = await fetch(LABELS_URL, { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        const fromFile =
          normalizeClassNames(j?.names) ||
          normalizeClassNames(j?.class_names) ||
          normalizeClassNames(j?.classNames) ||
          normalizeClassNames(j);
        if (fromFile) return fromFile;
      }
    } catch (e) {
      console.warn("Failed to load labels.json, using defaults:", e);
    }
    return DEFAULT_CLASS_NAMES;
  })();
  return classNamesPromise;
}

async function loadOrt() {
  if (ortPromise) return ortPromise;
  ortPromise = import(ORT_MJS_URL).then(
    (mod) => {
      const ort = mod.default || mod;
      // WASM tuning: threads + SIMD (COOP/COEP required on some hosts)
      ort.env.wasm.numThreads = Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2));
      ort.env.wasm.simd = true;
      ort.env.webgpu.powerPreference = "high-performance";

      // Ensure WASM binaries are fetched from a known location.
      // If not set, ORT will try to load e.g. "/ort-wasm-simd.wasm" from the current origin.
      const ortVersion = ort?.env?.versions?.web;
      const fallbackWasmBase = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${DEFAULT_ORT_VERSION}/dist/`;
      const defaultWasmBase = ortVersion
        ? `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ortVersion}/dist/`
        : fallbackWasmBase;
      ort.env.wasm.wasmPaths = ENV.ORT_WASM_BASE || defaultWasmBase;
      return ort;
    }
  );
  return ortPromise;
}

async function pickFirstAvailableUrl() {
  for (const url of CANDIDATE_MODELS) {
    try {
      const head = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (head.ok) return url;
    } catch (e) {
      console.warn("HEAD check failed for", url, e);
    }
  }
  // If HEAD not allowed, just return the first candidate and let create() fail if missing
  return CANDIDATE_MODELS[0];
}

function chooseProviders(ort) {
  // CPU-first: WASM is always available; WebGPU is opt-in.
  return ENABLE_WEBGPU ? ["webgpu", "wasm"] : ["wasm"];
}

async function getSession() {
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    const ort = await loadOrt();
    const modelUrl = await pickFirstAvailableUrl();
    if (!modelUrl) throw new Error("No ONNX model URL configured");

    const providers = chooseProviders(ort);
    console.log("Creating ONNX session", { modelUrl, providers });

    let session;
    try {
      session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: providers,
        graphOptimizationLevel: "all",
        enableMemPattern: true,
      });
    } catch (e) {
      // If WebGPU is enabled but fails (browser support, permissions, driver),
      // retry with WASM-only.
      if (ENABLE_WEBGPU) {
        console.warn("WebGPU session init failed, retrying with WASM:", e);
        session = await ort.InferenceSession.create(modelUrl, {
          executionProviders: ["wasm"],
          graphOptimizationLevel: "all",
          enableMemPattern: true,
        });
      } else {
        throw e;
      }
    }
    const inputMeta = session.inputNames?.[0]
      ? session.inputNames[0]
      : session.input?.[0]?.name;
    sessionInputName = inputMeta || "images";
    return { session, ort };
  })();
  return sessionPromise;
}

function makeLetterbox(image, size) {
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(size, size)
      : Object.assign(document.createElement("canvas"), { width: size, height: size });
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, size, size);

  const iw = image.width;
  const ih = image.height;
  const scale = Math.min(size / iw, size / ih);
  const newW = Math.round(iw * scale);
  const newH = Math.round(ih * scale);
  const padX = Math.floor((size - newW) / 2);
  const padY = Math.floor((size - newH) / 2);

  ctx.drawImage(image, padX, padY, newW, newH);
  const data = ctx.getImageData(0, 0, size, size).data;
  const planeSize = size * size;
  const floatData = new Float32Array(planeSize * 3);
  // Convert to CHW normalized [0,1]
  for (let p = 0, i = 0; i < data.length; i += 4, p++) {
    floatData[p] = data[i] / 255; // R
    floatData[p + planeSize] = data[i + 1] / 255; // G
    floatData[p + 2 * planeSize] = data[i + 2] / 255; // B
  }

  return {
    tensorData: floatData,
    meta: {
      scale,
      padX,
      padY,
      inputSize: size,
      origW: iw,
      origH: ih,
    },
  };
}

async function toImageLike({ imageElement, imageFile, imageUri }) {
  if (imageElement && imageElement.width && imageElement.height) {
    return imageElement;
  }
  const useBitmap = typeof createImageBitmap === "function";
  const blobToImage = async (blob) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = URL.createObjectURL(blob);
    });
  if (imageFile instanceof Blob) {
    return useBitmap ? await createImageBitmap(imageFile) : await blobToImage(imageFile);
  }
  if (imageUri) {
    const r = await fetch(imageUri, { cache: "no-store" });
    if (!r.ok) throw new Error(`Failed to fetch image: ${imageUri}`);
    const blob = await r.blob();
    return useBitmap ? await createImageBitmap(blob) : await blobToImage(blob);
  }
  throw new Error("No image source provided for ONNX inference.");
}

function mapToOriginalCoords(x1, y1, x2, y2, meta) {
  const invScale = 1 / meta.scale;
  const ox1 = Math.max(0, (x1 - meta.padX) * invScale);
  const oy1 = Math.max(0, (y1 - meta.padY) * invScale);
  const ox2 = Math.min(meta.origW, (x2 - meta.padX) * invScale);
  const oy2 = Math.min(meta.origH, (y2 - meta.padY) * invScale);
  const w = Math.max(0, ox2 - ox1);
  const h = Math.max(0, oy2 - oy1);
  return { x: Math.round(ox1), y: Math.round(oy1), w: Math.round(w), h: Math.round(h) };
}

function parseDetections(tensor, meta, confThreshold, classNames) {
  const data = tensor.data;
  const dims = tensor.dims;
  if (!dims || dims.length < 2) return [];

  const numDet = dims[dims.length - 2] || dims[1];
  const stride = dims[dims.length - 1] || 6;
  const boxes = [];

  for (let i = 0; i < numDet; i++) {
    const base = i * stride;
    const x1 = data[base];
    const y1 = data[base + 1];
    const x2 = data[base + 2];
    const y2 = data[base + 3];
    const score = data[base + 4];
    const clsId = data[base + 5];
    if (!Number.isFinite(score) || score < confThreshold) continue;

    const mapped = mapToOriginalCoords(x1, y1, x2, y2, meta);
    const classIdx = Number.isFinite(clsId) ? Math.round(clsId) : -1;
    const label =
      classIdx >= 0 && classIdx < classNames.length
        ? classNames[classIdx]
        : `class_${classIdx}`;

    boxes.push({
      x: mapped.x,
      y: mapped.y,
      w: mapped.w,
      h: mapped.h,
      label,
      score: Number(score),
      class_id: classIdx,
    });
  }
  return boxes;
}

export async function runLocalOnnx({
  imageElement,
  imageFile,
  imageUri,
  confThreshold = DEFAULT_CONF,
  inputSize = 640,
} = {}) {
  const { session, ort } = await getSession();
  const classNames = await loadClassNames();
  const meta = session.inputMetadata?.[sessionInputName];
  const dims = Array.isArray(meta?.dimensions)
    ? meta.dimensions
    : Array.isArray(meta?.shape)
      ? meta.shape
      : Array.isArray(meta?.dims)
        ? meta.dims
        : null;
  const metaH = dims ? dims[2] : undefined;
  const metaW = dims ? dims[3] : undefined;
  const size = Number.isFinite(metaH) && Number.isFinite(metaW) && metaH === metaW ? metaH : inputSize;
  const imageLike = await toImageLike({ imageElement, imageFile, imageUri });
  const { tensorData, meta: letterboxMeta } = makeLetterbox(imageLike, size);
  const inputTensor = new ort.Tensor("float32", tensorData, [1, 3, size, size]);
  const feeds = { [sessionInputName]: inputTensor };

  const outputs = await session.run(feeds);
  // Use first output tensor
  const firstKey = Object.keys(outputs)[0];
  const resultTensor = outputs[firstKey];
  const boxes = parseDetections(resultTensor, letterboxMeta, confThreshold, classNames);
  return { boxes, meta: letterboxMeta };
}

export async function warmupLocalOnnx() {
  // Small dummy inference to compile kernels
  try {
    const { session, ort } = await getSession();
    const size = 640;
    const dummy = new Float32Array(size * size * 3);
    const tensor = new ort.Tensor("float32", dummy, [1, 3, size, size]);
    await session.run({ [sessionInputName]: tensor });
  } catch (e) {
    console.warn("ONNX warmup failed:", e);
  }
}
