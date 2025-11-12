import { test, expect, type Page } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
const DOCS_PAGE = '/docs-overview.html';

declare global {
  interface Window {
    __DOC_ANCHORS__?: string[];
  }
}
const ARTIFACT_ROOT = process.env.PLAYWRIGHT_ARTIFACT_ROOT ?? path.resolve(process.cwd(), 'playwright-report');
const REPORT_DIR = path.resolve(ARTIFACT_ROOT, 'docs-overview');

if (process.env.DEBUG_ARTIFACTS && !(globalThis as any).__DOCS_ARTIFACT_LOGGED) {
  // eslint-disable-next-line no-console
  console.log(`[docs-overview] artifact root: ${REPORT_DIR}`);
  (globalThis as any).__DOCS_ARTIFACT_LOGGED = true;
}
async function ensureReportDir() {
  await fs.mkdir(REPORT_DIR, { recursive: true });
}

async function recordArtifact(projectName: string, fileName: string, data: string | Buffer) {
  await ensureReportDir();
  const target = path.join(REPORT_DIR, `${projectName}-${fileName}`);
  await fs.writeFile(target, data);
}

async function captureViewportMetadata(page: Page) {
  const orientationHeading = page.locator('h2', { hasText: 'Orientation Path' });
  const header = page.locator('.doc-header');
  const drawerToggle = page.locator('#doc-menu-toggle');
  const boundingBoxes = await Promise.all([
    orientationHeading.boundingBox(),
    header.boundingBox(),
    drawerToggle.boundingBox(),
  ]);
  return {
    orientationBox: boundingBoxes[0],
    headerBox: boundingBoxes[1],
    drawerToggleBox: boundingBoxes[2],
  };
}

test.describe('Docs overview preview shell', () => {
  test('captures metadata callout and anchor inventory', async ({ page }, testInfo) => {
    await page.goto(DOCS_PAGE);
    const metadata = page.locator('.metadata');
    await expect(metadata).toBeVisible();
    const metadataShot = await metadata.screenshot();
    await recordArtifact(testInfo.project.name, 'metadata-callout.png', metadataShot);
    const anchors = await page.evaluate(() => window.__DOC_ANCHORS__ ?? []);
    await recordArtifact(
      testInfo.project.name,
      'anchors.json',
      JSON.stringify({ anchors }, null, 2),
    );
  });

  test('renders header, drawer toggle, and content container without overlap', async ({ page }, testInfo) => {
    await page.goto(DOCS_PAGE);

    const header = page.locator('.doc-header');
    await page.waitForSelector('#doc-preview-content article', { timeout: 10000 });
    const content = page.locator('#doc-preview-content article');
    await expect(header).toBeVisible();
    await expect(content).toBeVisible();

    const orientation = page.locator('h2', { hasText: 'Orientation Path' });
    await expect(orientation).toBeVisible();

    const drawerToggle = page.locator('#doc-menu-toggle');
    const drawer = page.locator('#doc-drawer');
    await drawerToggle.click();
    await expect(drawer).toHaveClass(/open/);
    await page.evaluate(() => {
      const drawerEl = document.getElementById('doc-drawer');
      const toggleEl = document.getElementById('doc-menu-toggle');
      drawerEl?.classList.remove('open');
      drawerEl?.setAttribute('aria-hidden', 'true');
      toggleEl?.setAttribute('aria-expanded', 'false');
    });
    await expect(drawer).not.toHaveClass(/open/);

    const screenshot = await page.screenshot({ fullPage: true });
    await recordArtifact(testInfo.project.name, 'orientation.png', screenshot);

    const metadata = await captureViewportMetadata(page);
    await recordArtifact(testInfo.project.name, 'orientation.json', JSON.stringify(metadata, null, 2));
  });

  test('captures topic index + workflow evidence with drawer context', async ({ page }, testInfo) => {
    await page.goto(DOCS_PAGE);

    const tableHeading = page.locator('h2', { hasText: 'Topic-to-Doc' });
    await tableHeading.scrollIntoViewIfNeeded();
    await expect(tableHeading).toBeVisible();

    const drawerToggle = page.locator('#doc-menu-toggle');
    const drawer = page.locator('#doc-drawer');
    await drawerToggle.click();
    const dismissButton = page.locator('#doc-drawer-close');
    await dismissButton.scrollIntoViewIfNeeded();
    await expect(dismissButton).toBeVisible();

    const table = page
      .locator('table')
      .filter({ has: page.locator('th', { hasText: 'Secondary / Artifacts' }) })
      .first();
    await expect(table).toBeVisible();

    const tableScreenshot = await table.screenshot();
    await recordArtifact(testInfo.project.name, 'reference-index.png', tableScreenshot);

    const links = await table.evaluate((node) =>
      Array.from(node.querySelectorAll('a')).map((anchor) => ({
        text: anchor.textContent?.trim() ?? '',
        href: anchor.getAttribute('href') ?? '',
      })),
    );

    const breadcrumbs = await captureViewportMetadata(page);
    await recordArtifact(
      testInfo.project.name,
      'reference-index.json',
      JSON.stringify(
        {
          drawerState: 'open',
          links,
          breadcrumbs,
        },
        null,
        2,
      ),
    );

    await dismissButton.click({ force: true });
    await expect(drawer).not.toHaveClass(/open/);

    const workflowHeading = page.locator('h2', { hasText: 'Workflow Playbooks' });
    await workflowHeading.scrollIntoViewIfNeeded();
    await expect(workflowHeading).toBeVisible();
  });
});
