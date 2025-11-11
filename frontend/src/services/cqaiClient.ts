type EnvConfig = {
  API_BASE?: string | null;
};

function getEnv(): EnvConfig {
  return (window as unknown as { __ENV__?: EnvConfig }).__ENV__ ?? {};
}

function getApiBase(): string {
  return getEnv().API_BASE ?? '';
}

function isMockMode(): boolean {
  const apiBase = getApiBase();
  return apiBase === null || apiBase === undefined || apiBase === '';
}

export async function fetchCase(caseId = 'DEMO-001'): Promise<unknown> {
  // In dev mode (useMock), serve case files from public directory
  // Vite serves public/ at root, so mock/case-002.json -> /mock/case-002.json
  if (isMockMode()) {
    const caseMapping: Record<string, string> = {
      'DEMO-001': 'case-demo.json',
      'DEMO-002': 'case-002.json',
      'DEMO-003': 'case-003.json',
      'DEMO-004': 'case-004.json',
    };
    const caseFile = caseMapping[caseId] || 'case-demo.json';
    const url = `/mock/${caseFile}`;
    const response = await fetch(url, {
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`case fetch failed: ${response.status}`);
    }
    return response.json();
  }
  
  // In production, use API endpoint
  const url = `${getApiBase()}/cases/${caseId}`;
  const response = await fetch(url, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`case fetch failed: ${response.status}`);
  }
  return response.json();
}

export function resolveUri(uri: string): string {
  // If it's already a full URL, return as-is
  if (/^https?:\/\//.test(uri)) {
    return uri;
  }
  
  // In dev mode (useMock), serve from public directory
  // Vite serves public/ at root, so images/case2.png -> /images/case2.png
  if (isMockMode()) {
    // Ensure leading slash for absolute path
    return uri.startsWith('/') ? uri : `/${uri}`;
  }
  
  // In production with API_BASE, prepend API_BASE
  const apiBase = getApiBase();
  const needsSlash = uri.startsWith('/') ? '' : '/';
  return `${apiBase}${needsSlash}${uri}`;
}

