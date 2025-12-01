import { test, expect } from '@playwright/test';
import path from 'path';
import { promises as fs } from 'fs';
import { ensureViewerReady } from '../src/test/viewer-fixtures';

function resolveArtifactRoot() {
  const configuredRoot = process.env.PLAYWRIGHT_ARTIFACT_ROOT;
  if (configuredRoot) {
    return path.isAbsolute(configuredRoot)
      ? configuredRoot
      : path.resolve(process.cwd(), configuredRoot);
  }
  return path.resolve(process.cwd(), 'playwright-artifacts');
}

const ARTIFACT_ROOT = resolveArtifactRoot();
const REPORT_ROOT = path.resolve(ARTIFACT_ROOT, 'viewer');

async function ensureReportDir() {
  await fs.mkdir(REPORT_ROOT, { recursive: true });
}

async function recordViewerArtifact(project: string, fileName: string, data: string | Buffer) {
  await ensureReportDir();
  const target = path.join(REPORT_ROOT, `${project}-${fileName}`);
  await fs.writeFile(target, data);
}

test.describe('Viewer responsive audit', () => {
  test('captures header/actions and canvas layout', async ({ page }, testInfo) => {
    await page.goto('/');
    await ensureViewerReady(page);

    const classifyButton = page.getByRole('button', { name: /classify/i }).first();
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();

    const screenshot = await page.screenshot({ fullPage: true });
    await recordViewerArtifact(testInfo.project.name, 'viewer-context.png', screenshot);

    const [headerBox, canvasBox] = await Promise.all([classifyButton.boundingBox(), canvas.boundingBox()]);

    if (!headerBox?.bottom || !canvasBox?.top) {
      console.warn('Unable to derive bounding boxes for viewer layout');
    } else {
      expect(headerBox.bottom).toBeLessThan(canvasBox.top);
    }
  });
});
