import { test, expect, TestInfo } from '@playwright/test';

declare global {
  interface Window {
    __viewerDebug?: {
      getAlignmentSnapshot?: () => any;
      getUserRois?: () => any[];
    };
  }
}

const ALIGNMENT_TOLERANCE = 5;
const CENTER_TOLERANCE_RATIO = 0.1; // 10% of dimension

async function attachSnapshot(testInfo: TestInfo, snapshot: any, name: string) {
  await testInfo.attach(name, {
    body: Buffer.from(JSON.stringify(snapshot, null, 2)),
    contentType: 'application/json',
  });
}

async function waitForAlignmentSnapshot(page) {
  await page.waitForFunction(() => {
    const snapshot = window.__viewerDebug?.getAlignmentSnapshot?.();
    return Boolean(snapshot && snapshot.boundingRects?.overlayCanvas && snapshot.boundingRects?.imageCanvas);
  }, { timeout: 20000 });
  return page.evaluate(() => window.__viewerDebug!.getAlignmentSnapshot());
}

async function waitForImageToRender(page) {
  await page.waitForSelector('canvas#overlayCanvas', { state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => Boolean(document.getElementById('imageCanvas')), { timeout: 20000 });
  await page.waitForFunction(() => {
    const dropZone = document.getElementById('dropZone');
    return dropZone ? dropZone.style.display === 'none' : true;
  }, { timeout: 20000 }).catch(() => {});
}

test.describe('Mobile Safari alignment', () => {
  test('image canvas stays aligned with overlays and container', async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== 'webkit', 'Validated on mobile Safari (WebKit) only');

    await page.goto('/');
    await waitForImageToRender(page);

    const snapshot = await waitForAlignmentSnapshot(page);
    await attachSnapshot(testInfo, snapshot, 'alignment-snapshot');
    expect(snapshot).toBeTruthy();

    const imageRect = snapshot.boundingRects.imageCanvas;
    const overlayRect = snapshot.boundingRects.overlayCanvas;
    expect(imageRect).toBeTruthy();
    expect(overlayRect).toBeTruthy();

    expect(Math.abs(imageRect.left - overlayRect.left)).toBeLessThanOrEqual(ALIGNMENT_TOLERANCE);
    expect(Math.abs(imageRect.top - overlayRect.top)).toBeLessThanOrEqual(ALIGNMENT_TOLERANCE);
    expect(Math.abs(imageRect.width - overlayRect.width)).toBeLessThanOrEqual(ALIGNMENT_TOLERANCE);
    expect(Math.abs(imageRect.height - overlayRect.height)).toBeLessThanOrEqual(ALIGNMENT_TOLERANCE);

    expect(Math.abs(imageRect.width - snapshot.containerSize.width)).toBeLessThanOrEqual(ALIGNMENT_TOLERANCE);
    expect(Math.abs(imageRect.height - snapshot.containerSize.height)).toBeLessThanOrEqual(ALIGNMENT_TOLERANCE);

    const scaledWidth = snapshot.imageDimensions.width * snapshot.transform.scale;
    const scaledHeight = snapshot.imageDimensions.height * snapshot.transform.scale;
    const expectedTx = (snapshot.containerSize.width - scaledWidth) / 2;
    const expectedTy = (snapshot.containerSize.height - scaledHeight) / 2;
    expect(Math.abs(snapshot.transform.tx - expectedTx)).toBeLessThanOrEqual(ALIGNMENT_TOLERANCE);
    expect(Math.abs(snapshot.transform.ty - expectedTy)).toBeLessThanOrEqual(ALIGNMENT_TOLERANCE);
  });

  test('drawing ROIs preserves image coordinates on mobile Safari', async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== 'webkit', 'Validated on mobile Safari (WebKit) only');

    await page.goto('/');
    await waitForImageToRender(page);
    const overlayCanvas = page.locator('canvas#overlayCanvas');
    const box = await overlayCanvas.boundingBox();
    if (!box) test.fail();

    const syntheticRect = {
      x: box.width / 2 - 40,
      y: box.height / 2 - 40,
      width: 80,
      height: 80,
    };

    await page.evaluate((rect) => {
      window.__viewerDebug!.addSyntheticRoi?.(rect);
    }, syntheticRect);

    const { rois, imageDimensions } = await page.evaluate(() => ({
      rois: window.__viewerDebug!.getUserRois?.() || [],
      imageDimensions: window.__viewerDebug!.getAlignmentSnapshot?.()?.imageDimensions,
    }));
    await attachSnapshot(testInfo, { rois, imageDimensions }, 'roi-snapshot');

    expect(Array.isArray(rois) && rois.length).toBeTruthy();
    const roi = rois[rois.length - 1];
    const roiCenterX = (roi.xmin + roi.xmax) / 2;
    const roiCenterY = (roi.ymin + roi.ymax) / 2;
    const imageCenterX = imageDimensions.width / 2;
    const imageCenterY = imageDimensions.height / 2;

    expect(Math.abs(roiCenterX - imageCenterX)).toBeLessThanOrEqual(imageDimensions.width * CENTER_TOLERANCE_RATIO);
    expect(Math.abs(roiCenterY - imageCenterY)).toBeLessThanOrEqual(imageDimensions.height * CENTER_TOLERANCE_RATIO);
  });
});
