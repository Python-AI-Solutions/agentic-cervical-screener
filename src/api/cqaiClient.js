const ENV = window.__ENV__ || {};
const API_BASE = ENV.API_BASE || '';
const useMock = !API_BASE;

export async function fetchCase(caseId = 'DEMO-001') {
  if (useMock) { 
    // For mock mode, use backend service for case data
    const r = await fetch(`${API_BASE}/cases/${caseId}`); 
    if(!r.ok) throw new Error('mock case failed'); 
    return r.json(); 
  }
  const r = await fetch(`${API_BASE}/cases/${caseId}`); if(!r.ok) throw new Error('case fetch failed'); return r.json();
}
export function resolveUri(uri) {
  if (useMock) {
    // For mock mode, use backend service for images and mock data
    if (uri.startsWith('mock/') || uri.startsWith('images/')) {
      // Use backend service instead of /public/ prefix
      return `${API_BASE}/${uri}`;
    }
    return uri;
  }
  if (/^https?:\/\//.test(uri)) return uri;
  return `${API_BASE}${uri.startsWith('/')?'':'/'}${uri}`;
}
