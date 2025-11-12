import '../../styles/main.css';
import '../../styles/niivue.css';
import 'tw-elements';
import { marked } from 'marked';
import overviewMarkdown from '@docs/project_overview.md?raw';

declare global {
  interface Window {
    __DOC_ANCHORS__?: string[];
  }
}

const root = document.getElementById('docs-overview-root');

const shellTemplate = `
  <header class="doc-header" aria-label="Project Overview header">
    <button id="doc-menu-toggle" class="doc-icon-button" aria-haspopup="true" aria-expanded="false" aria-controls="doc-drawer">
      ☰
    </button>
    <div class="doc-brand">
      <span class="doc-brand-name">Agentic Cervical Screener</span>
      <span class="doc-status-pill">docs overview</span>
    </div>
    <div class="doc-actions">
      <button id="doc-open-case" class="doc-action primary">Case Management</button>
      <button id="doc-open-help" class="doc-action">Help</button>
    </div>
  </header>
  <main class="doc-main" aria-live="polite">
    <div id="doc-preview-content" class="doc-content" aria-label="Documentation body"></div>
  </main>
  <aside id="doc-drawer" class="doc-drawer" aria-hidden="true">
    <header class="doc-drawer-header">
      <h2>Case Management</h2>
      <button id="doc-drawer-close" class="doc-icon-button" aria-label="Close Case Management">&times;</button>
    </header>
    <section>
      <button class="doc-action full-width">Load Image from Computer</button>
      <div class="doc-quick-load">
        <p>Quick Load Cases:</p>
        <button>Case 1</button>
        <button>Case 2</button>
        <button>Case 3</button>
        <button>Case 4</button>
      </div>
      <div class="doc-layer-toggle">
        <label for="doc-layer-toggle-input">user-drawn-rois (rects)</label>
        <input id="doc-layer-toggle-input" type="checkbox" checked />
      </div>
    </section>
  </aside>
`;

marked.setOptions({ mangle: false, headerIds: false });

function applyStyles() {
  if (document.getElementById('doc-overview-style')) {
    return;
  }
  const style = document.createElement('style');
  style.id = 'doc-overview-style';
  style.textContent = `
    :root {
      color-scheme: dark;
    }
    body {
      background: #0a1120;
      color: #e2e8f0;
      min-height: 100vh;
      margin: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .doc-shell {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      padding-bottom: env(safe-area-inset-bottom);
    }
    .doc-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px clamp(16px, 4vw, 32px);
      gap: 16px;
      position: sticky;
      top: 0;
      z-index: 20;
      background: rgba(10, 17, 32, 0.95);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(226, 232, 240, 0.2);
    }
    .doc-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.9rem;
    }
    .doc-status-pill {
      padding: 4px 8px;
      border-radius: 999px;
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid rgba(129, 140, 248, 0.5);
      font-size: 0.75rem;
      text-transform: lowercase;
    }
    .doc-actions {
      display: flex;
      gap: 12px;
    }
    .doc-action {
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.4);
      background: transparent;
      color: inherit;
      padding: 8px 16px;
      font-weight: 600;
      cursor: pointer;
      min-width: 140px;
      text-align: center;
    }
    .doc-action.primary {
      background: linear-gradient(90deg, #6366f1, #8b5cf6);
      border-color: transparent;
    }
    .doc-icon-button {
      width: 44px;
      height: 44px;
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.4);
      background: transparent;
      color: inherit;
      font-size: 1.25rem;
      cursor: pointer;
    }
    .doc-main {
      flex: 1;
      padding: clamp(16px, 4vw, 40px);
      max-width: 960px;
      width: 100%;
      margin: 0 auto;
    }
    .doc-content {
      background: rgba(15, 23, 42, 0.8);
      border-radius: 16px;
      border: 1px solid rgba(148, 163, 184, 0.2);
      padding: clamp(16px, 3vw, 32px);
      box-shadow: 0 10px 40px rgba(15, 23, 42, 0.4);
    }
    .doc-content h1,
    .doc-content h2,
    .doc-content h3,
    .doc-content h4 {
      color: #f1f5f9;
    }
    .doc-content table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .doc-content table th,
    .doc-content table td {
      border: 1px solid rgba(148, 163, 184, 0.3);
      padding: 8px;
    }
    .doc-drawer {
      position: fixed;
      top: clamp(56px, 6vh, 72px);
      right: 12px;
      bottom: clamp(16px, 4vh, 24px);
      width: min(360px, 85vw);
      border-radius: 16px;
      border: 1px solid rgba(148, 163, 184, 0.3);
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(2, 6, 23, 0.95));
      padding: 16px;
      box-shadow: 0 25px 60px rgba(15, 23, 42, 0.6);
      transform: translateX(calc(100% + 24px));
      transition: transform 0.3s ease;
      z-index: 30;
    }
    .doc-drawer.open {
      transform: translateX(0);
    }
    .doc-drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .doc-quick-load button,
    .doc-layer-toggle button {
      width: 100%;
      margin-bottom: 8px;
      border-radius: 8px;
      border: 1px solid rgba(148, 163, 184, 0.2);
      background: rgba(30, 41, 59, 0.8);
      color: inherit;
      padding: 8px 12px;
      text-align: left;
      cursor: pointer;
    }
    .doc-action.full-width {
      width: 100%;
    }
    @media (max-width: 768px) {
      .doc-actions {
        flex-direction: column;
        align-items: stretch;
      }
      .doc-main {
        padding-bottom: calc(32px + env(safe-area-inset-bottom));
      }
    }
  `;
  document.head.appendChild(style);
}

type RenderedDoc = {
  metadataHtml: string;
  bodyHtml: string;
  anchorSlugs: string[];
};

async function loadFromBackend(): Promise<RenderedDoc> {
  const res = await fetch('/docs/project-overview');
  if (!res.ok) {
    throw new Error(`Backend responded with ${res.status}`);
  }
  const html = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const meta = doc.querySelector('section.metadata');
  const article = doc.querySelector('article');
  if (!article) {
    throw new Error('Backend response missing article');
  }
  let anchorSlugs: string[] = [];
  try {
    const anchorRes = await fetch('/docs/project-overview/anchors');
    if (anchorRes.ok) {
      const data = await anchorRes.json();
      anchorSlugs = Array.isArray(data?.anchors) ? data.anchors.map((anchor: any) => anchor.slug) : [];
    }
  } catch {
    // ignore backend anchor failures
  }
  return {
    metadataHtml: meta?.outerHTML ?? '',
    bodyHtml: article.outerHTML,
    anchorSlugs,
  };
}

type FrontMatter = Record<string, string | string[]>;

function parseFrontMatter(raw: string): { data: FrontMatter; content: string } {
  const lines = raw.split(/\r?\n/);
  if (!lines.length || lines[0].trim() !== '---') {
    return { data: {}, content: raw };
  }
  const data: FrontMatter = {};
  let idx = 1;
  let currentKey: string | null = null;
  for (; idx < lines.length; idx += 1) {
    const line = lines[idx];
    if (line.trim() === '---') {
      break;
    }
    const arrayMatch = line.match(/^\s*-\s+(.*)$/);
    if (arrayMatch && currentKey) {
      const entry = arrayMatch[1].trim();
      const existing = Array.isArray(data[currentKey]) ? (data[currentKey] as string[]) : [];
      existing.push(entry);
      data[currentKey] = existing;
      continue;
    }
    const keyMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (keyMatch) {
      currentKey = keyMatch[1].trim();
      const value = keyMatch[2].trim();
      if (value) {
        data[currentKey] = value;
        currentKey = null;
      } else {
        data[currentKey] = [];
      }
    }
  }
  const content = lines.slice(idx + 1).join('\n');
  return { data, content };
}

const staticDoc = (() => {
  const { data, content } = parseFrontMatter(overviewMarkdown);
  const metadataHtml = `
    <section class="metadata" aria-label="Document metadata">
      <h2>Document Metadata</h2>
      <ul>
        ${Object.entries(data)
          .map(([key, value]) => `<li><strong>${key}</strong>: ${Array.isArray(value) ? value.join(', ') : value}</li>`)
          .join('')}
      </ul>
    </section>
  `;
  const bodyHtml = `<article class="markdown-body">${marked.parse(content)}</article>`;
  const anchorSlugs = Array.isArray(data.anchor_slugs) ? (data.anchor_slugs as string[]) : [];
  return { metadataHtml, bodyHtml, anchorSlugs };
})();

async function renderDocument() {
  const container = document.getElementById('doc-preview-content');
  if (!container) return;
  container.setAttribute('aria-busy', 'true');
  try {
    container.innerHTML = `${staticDoc.metadataHtml}${staticDoc.bodyHtml}`;
    window.__DOC_ANCHORS__ = staticDoc.anchorSlugs;
    let rendered: RenderedDoc | null = null;
    try {
      rendered = await loadFromBackend();
    } catch {
      // backend route unavailable (dev mode without FastAPI); keep static content
    }
    if (rendered) {
      container.innerHTML = `${rendered.metadataHtml}${rendered.bodyHtml}`;
      window.__DOC_ANCHORS__ = rendered.anchorSlugs;
    }
  } catch (error) {
    container.innerHTML = `<p>Failed to load project overview: ${(error as Error).message}</p>`;
  } finally {
    container.setAttribute('aria-busy', 'false');
  }
}

function setupDrawer() {
  const drawer = document.getElementById('doc-drawer');
  const toggle = document.getElementById('doc-menu-toggle');
  const close = document.getElementById('doc-drawer-close');
  const caseBtn = document.getElementById('doc-open-case');
  const closeDrawer = () => {
    drawer?.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
    drawer?.setAttribute('aria-hidden', 'true');
  };
  const openDrawer = () => {
    drawer?.classList.add('open');
    toggle?.setAttribute('aria-expanded', 'true');
    drawer?.setAttribute('aria-hidden', 'false');
  };
  toggle?.addEventListener('click', () => {
    if (drawer?.classList.contains('open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });
  caseBtn?.addEventListener('click', openDrawer);
  close?.addEventListener('click', closeDrawer);
}

function bootstrap() {
  if (!root) return;
  applyStyles();
  root.classList.add('doc-shell');
  root.innerHTML = shellTemplate;
  setupDrawer();
  void renderDocument();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
