const ENV = window.__ENV__ || {};
const API_BASE = ENV.API_BASE || '';
const useApiBase = typeof API_BASE === 'string' && API_BASE.length > 0;
export function resolveUri(uri) {
  if (/^https?:\/\//.test(uri)) return uri;
  // Keep paths relative so the app can be hosted at a subpath if needed.
  if (!useApiBase) return uri.startsWith('/') ? uri.slice(1) : uri;
  return `${API_BASE}${uri.startsWith('/') ? '' : '/'}${uri}`;
}
