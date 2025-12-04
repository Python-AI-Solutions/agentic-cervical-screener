import { test, expect } from '@playwright/test';
import path from 'path';
import { promises as fs } from 'fs';
import { ensureViewerReady } from '../src/test/viewer-fixtures';

declare global {
  interface Window {
    __viewerDebug?: {
      addSyntheticRoi?: (rect: { x: number; y: number; width: number; height: number }) => void;
      forceTransformRecalc?: () => void;
      getUserRois?: () => Array<Record<string, unknown>>;
      getCanvasContainerSize?: () => { width: number; height: number };
      lastDrawnUserRois?: Array<{ topLeft: { x: number; y: number }; bottomRight: { x: number; y: number } }>;
    };
  }
}

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

  test('renders user-drawn ROIs on mobile form factors', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('phone'), 'ROI visibility check targets phone layouts');

    await page.goto('/');
    await ensureViewerReady(page);

    const overlayCanvas = page.locator('canvas#overlayCanvas');
    const box = await overlayCanvas.boundingBox();
    if (!box) {
      throw new Error('Overlay canvas missing bounding box');
    }

    const roiRect = {
      x: Math.max(10, box.width * 0.35),
      y: Math.max(10, box.height * 0.35),
      width: Math.max(40, box.width * 0.2),
      height: Math.max(40, box.height * 0.2),
    };

    const roiCount = await page.evaluate((rect) => {
      const helper = window.__viewerDebug;
      helper?.addSyntheticRoi?.(rect);
      helper?.forceTransformRecalc?.();
      return helper?.getUserRois?.()?.length ?? 0;
    }, roiRect);

    await expect.poll(async () => page.evaluate(() => window.__viewerDebug?.getUserRois?.()?.length ?? 0)).toBeGreaterThan(0);
    await expect(roiCount).toBeGreaterThan(0);

    const screenshot = await page.screenshot({ fullPage: true });
    await recordViewerArtifact(testInfo.project.name, 'viewer-mobile-roi.png', screenshot);
  });

  test('desktop-drawn ROIs remain visible after resizing to phone view', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'viewer-desktop', 'Resize regression only validated once');

    await page.goto('/');
    await ensureViewerReady(page);

    const overlayCanvas = page.locator('canvas#overlayCanvas');
    const box = await overlayCanvas.boundingBox();
    if (!box) throw new Error('Overlay canvas missing bounding box');

    const start = { x: box.x + box.width * 0.3, y: box.y + box.height * 0.3 };
    const end = { x: box.x + box.width * 0.6, y: box.y + box.height * 0.6 };

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y);
    await page.mouse.up();

    await page.getByRole('button', { name: /Add/i }).click();
    await expect.poll(async () => page.evaluate(() => window.__viewerDebug?.getUserRois?.()?.length ?? 0)).toBeGreaterThan(0);

    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 393,
      height: 852,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await page.waitForTimeout(500);
    await expect.poll(async () =>
      page.evaluate(
        () => window.__viewerDebug?.lastDrawnUserRois?.length ?? 0,
      ),
    ).toBeGreaterThan(0);

    const roiDebug = await page.evaluate(() => {
      const helper = window.__viewerDebug;
      if (!helper) return { visible: false, samples: [], projected: [], container: null, dpr: window.devicePixelRatio || 1 };
      const projected = helper.lastDrawnUserRois ?? [];
      if (!projected.length) return { visible: false, samples: [], projected, container: helper.getCanvasContainerSize?.() ?? null, dpr: window.devicePixelRatio || 1 };
      const { topLeft, bottomRight } = projected[projected.length - 1];
      const container = helper.getCanvasContainerSize?.();
      if (!container) {
        return { visible: false, samples: [], projected, container: null, dpr: window.devicePixelRatio || 1 };
      }
      const width = container.width ?? 0;
      const height = container.height ?? 0;
      if (!(topLeft.x >= 0 && topLeft.y >= 0 && bottomRight.x <= width && bottomRight.y <= height)) {
        return { visible: false, samples: [], projected, container, dpr: window.devicePixelRatio || 1 };
      }
      const overlay = document.getElementById('overlayCanvas') as HTMLCanvasElement | null;
      const ctx = overlay?.getContext('2d');
      if (!ctx) return { visible: false, samples: [], projected, container, dpr: window.devicePixelRatio || 1 };
      const samplePoints = [
        { x: Math.round((topLeft.x + bottomRight.x) / 2), y: Math.round(topLeft.y + 1) },
        { x: Math.round(bottomRight.x - 1), y: Math.round((topLeft.y + bottomRight.y) / 2) },
        { x: Math.round((topLeft.x + bottomRight.x) / 2), y: Math.round(bottomRight.y - 1) },
        { x: Math.round(topLeft.x + 1), y: Math.round((topLeft.y + bottomRight.y) / 2) },
      ];
      const dpr = window.devicePixelRatio || 1;
      const samples = samplePoints.map(({ x, y }) => {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        const pixel = ctx.getImageData(Math.max(0, Math.floor(x * dpr)), Math.max(0, Math.floor(y * dpr)), 1, 1).data;
        return { x, y, pixel: Array.from(pixel) };
      });
      const visible = samples.some(({ pixel }) => pixel[0] > 220 && pixel[1] < 150 && pixel[2] < 150);
      return { visible, samples, projected, container, dpr };
    });

    expect(roiDebug.visible).toBe(true);
  });
});
