import { test, expect, TestInfo, Page } from '@playwright/test';

/**
 * Helpers
 */
const isMobileProject = (testInfo: TestInfo) => /mobile/i.test(testInfo.project.name ?? '');

async function showSidebarIfHidden(page: Page, testInfo: TestInfo) {
  if (!isMobileProject(testInfo)) return;
  const sidebarVisible = await page.evaluate(() => {
    const el = document.getElementById('sidebar');
    return el?.classList.contains('mobile-visible');
  });
  if (!sidebarVisible) {
    await page.locator('#mobileMenuBtn').click();
    await page.waitForFunction(() => document.getElementById('sidebar')?.classList.contains('mobile-visible'));
  }
}

type RectLike = { left: number; right: number; top: number; bottom: number; width: number; height: number };
type HeaderMetrics = {
  viewportWidth: number;
  viewportHeight: number;
  hamburgerVisible: boolean;
  buttons: Array<RectLike & { text: string }>;
  brand: RectLike | null;
  status: RectLike | null;
  container: RectLike | null;
};

async function collectHeaderMetrics(page: Page): Promise<HeaderMetrics> {
  return page.evaluate(() => {
    const toRect = (rect: DOMRect | null | undefined) =>
      rect
        ? {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          }
        : null;

    const buttonRects = Array.from(document.querySelectorAll('#headerButtons button.medical-button')).map((btn) => {
      const rect = btn.getBoundingClientRect();
      return {
        text: (btn.textContent || '').trim(),
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    });

    const hamburger = document.getElementById('mobileMenuBtn');
    const hamburgerVisible = hamburger ? window.getComputedStyle(hamburger).display !== 'none' : false;

    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      hamburgerVisible,
      buttons: buttonRects,
      brand: toRect(document.getElementById('brandTitle')?.getBoundingClientRect()),
      status: toRect(document.getElementById('status')?.getBoundingClientRect()),
      container: toRect(document.getElementById('headerButtons')?.getBoundingClientRect()),
    };
  });
}

async function waitForHeaderButtons(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelectorAll('#headerButtons button.medical-button').length >= 3);
}

async function attachHeaderArtifacts(page: Page, testInfo: TestInfo, name: string, clipHeight = 220): Promise<void> {
  const viewport = page.viewportSize();
  const width = viewport?.width ?? (await page.evaluate(() => window.innerWidth));
  const height = viewport?.height ?? (await page.evaluate(() => window.innerHeight));
  const clip = {
    x: 0,
    y: 0,
    width: Math.max(1, Math.min(Math.round(width), 1920)),
    height: Math.max(1, Math.min(Math.round(clipHeight), Math.round(height))),
  };
  const screenshot = await page.screenshot({ clip }).catch(() => page.screenshot({ fullPage: true }));
  await testInfo.attach(`${name}.png`, {
    body: screenshot,
    contentType: 'image/png',
  });
}

function countDistinctRows(buttons: Array<RectLike & { text: string }>): number {
  if (!buttons.length) return 0;
  const sorted = buttons.map((b) => b.top).sort((a, b) => a - b);
  const threshold = 6; // px
  const rows: number[] = [];
  for (const top of sorted) {
    const last = rows[rows.length - 1];
    if (last === undefined || Math.abs(top - last) > threshold) {
      rows.push(top);
    }
  }
  return rows.length;
}

/**
 * E2E tests using Playwright
 * These tests run in a real browser and test actual functionality
 */

test.describe('Image Loading E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to initialize
    await page.waitForSelector('#viewer', { timeout: 5000 });
  });

  test('should load case images correctly', async ({ page }) => {
    // Wait for initial case to load
    await page.waitForSelector('canvas#glCanvas', { timeout: 10000 });
    
    // Check that canvas is rendered
    const canvas = page.locator('canvas#glCanvas');
    await expect(canvas).toBeVisible();
    
    // Check that drop zone is hidden when image loads
    const dropZone = page.locator('#dropZone');
    await expect(dropZone).not.toBeVisible();
  });

  test('should load Case 2 when clicking button', async ({ page }, testInfo) => {
    await showSidebarIfHidden(page, testInfo);
    // Click Case 2 button
    await page.click('button:has-text("Case 2")');
    
    // Wait for image to load
    await page.waitForTimeout(2000);
    
    // Verify canvas is still visible
    const canvas = page.locator('canvas#glCanvas');
    await expect(canvas).toBeVisible();
    
    // Check status shows ready
    const status = page.locator('#status');
    await expect(status).toContainText(/ready|loading/i);
  });

  test('should handle image file upload', async ({ page }) => {
    // Create a test image file
    const testImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    
    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: testImage,
    });
    
    // Wait for processing
    await page.waitForTimeout(1000);
    
    // Verify canvas is visible
    const canvas = page.locator('canvas#glCanvas');
    await expect(canvas).toBeVisible();
  });
});

test.describe('Case Loading E2E', () => {
  test('should load all demo cases', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.waitForSelector('#viewer', { timeout: 5000 });
    await showSidebarIfHidden(page, testInfo);
    
    const cases = ['Case 1', 'Case 2', 'Case 3', 'Case 4'];
    
    for (const caseName of cases) {
      // Click case button
      await page.click(`button:has-text("${caseName}")`);
      
      // Wait for load
      await page.waitForTimeout(2000);
      
      // Verify canvas is visible
      const canvas = page.locator('canvas#glCanvas');
      await expect(canvas).toBeVisible();
      
      // Verify status
      const status = page.locator('#status');
      await expect(status).not.toContainText('error');
    }
  });
});

test.describe('UI Interactions E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#viewer', { timeout: 5000 });
    await page.waitForSelector('canvas#glCanvas', { timeout: 10000 });
  });

  test('should toggle sidebar on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Wait for layout to settle
    await page.waitForTimeout(500);
    
    // Check sidebar is hidden initially (off-screen to the left)
    const sidebar = page.locator('#sidebar');
    
    // Check that sidebar is not visible (translated off-screen)
    // We check the bounding box - if it's off-screen, the x position will be negative
    const initialBox = await sidebar.boundingBox();
    expect(initialBox).not.toBeNull();
    // Sidebar should be off-screen (x position negative or outside viewport)
    expect(initialBox!.x).toBeLessThan(0);
    
    const menuButton = page.locator('#mobileMenuBtn');
    await menuButton.scrollIntoViewIfNeeded();
    await menuButton.click();
    await page.waitForFunction(() => document.getElementById('sidebar')?.classList.contains('mobile-visible'));
    
    await page.waitForFunction(() => {
      const el = document.getElementById('sidebar');
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.left >= 0;
    });
    const visibleBox = await sidebar.boundingBox();
    expect(visibleBox).not.toBeNull();
    // Sidebar should be on-screen (x position >= 0)
    expect(visibleBox!.x).toBeGreaterThanOrEqual(0);
    
    // Verify sidebar is actually visible
    await expect(sidebar).toBeVisible();
  });

  test('should show layer controls', async ({ page }) => {
    // Wait for layers to be populated
    await page.waitForTimeout(1000);
    
    // Check layers section exists
    const layersSection = page.locator('#layers');
    await expect(layersSection).toBeVisible();
  });
});

test.describe('Mobile Responsiveness', () => {
  const layoutScenarios = [
    {
      name: 'desktop-wide',
      viewport: { width: 1440, height: 900 },
      expectHamburger: false,
      minRows: 1,
      maxRows: 1,
      stackBelowBrand: false,
      overflowAllowance: 0,
    },
    {
      name: 'tablet-portrait',
      viewport: { width: 834, height: 1112 },
      expectHamburger: true,
      minRows: 1,
      maxRows: 2,
      stackBelowBrand: true,
      overflowAllowance: 0,
    },
    {
      name: 'phone-large',
      viewport: { width: 428, height: 926 },
      expectHamburger: true,
      minRows: 2,
      stackBelowBrand: true,
      overflowAllowance: 0,
    },
    {
      name: 'phone-small',
      viewport: { width: 375, height: 667 },
      expectHamburger: true,
      minRows: 2,
      stackBelowBrand: true,
      overflowAllowance: 0,
    },
  ];

  layoutScenarios.forEach((scenario) => {
    test(`header layout – ${scenario.name}`, async ({ page }, testInfo) => {
      if (isMobileProject(testInfo)) {
        test.skip();
      }
      await page.setViewportSize(scenario.viewport);
      await page.goto('/');
      await waitForHeaderButtons(page);
      const metrics = await collectHeaderMetrics(page);
      await attachHeaderArtifacts(page, testInfo, `header-${scenario.name}`);
      await testInfo.attach(`metrics-${scenario.name}.json`, {
        body: Buffer.from(JSON.stringify(metrics, null, 2)),
        contentType: 'application/json',
      });

      expect(metrics.buttons.length).toBeGreaterThanOrEqual(3);
      expect(metrics.hamburgerVisible).toBe(scenario.expectHamburger);

      const rows = countDistinctRows(metrics.buttons);
      expect(rows).toBeGreaterThanOrEqual(scenario.minRows ?? 1);
      if (scenario.maxRows) {
        expect(rows).toBeLessThanOrEqual(scenario.maxRows);
      }

      const EDGE_TOLERANCE = 1;
      metrics.buttons.forEach((button) => {
        expect(button.left).toBeGreaterThanOrEqual(-EDGE_TOLERANCE);
        expect(button.right).toBeLessThanOrEqual(metrics.viewportWidth + (scenario.overflowAllowance ?? 0));
      });

      if (metrics.status) {
        expect(metrics.status.right).toBeLessThanOrEqual(metrics.viewportWidth + EDGE_TOLERANCE);
      }

      if (scenario.stackBelowBrand && metrics.brand) {
        const minTop = Math.min(...metrics.buttons.map((b) => b.top));
        expect(minTop).toBeGreaterThanOrEqual(metrics.brand.bottom - 4);
      } else if (!scenario.stackBelowBrand && metrics.brand) {
        const avgButtonTop = metrics.buttons.reduce((sum, b) => sum + b.top, 0) / metrics.buttons.length;
        expect(Math.abs(avgButtonTop - metrics.brand.top)).toBeLessThanOrEqual(10);
      }
    });
  });

  test('header layout – device profile', async ({ page }, testInfo) => {
    test.skip(!isMobileProject(testInfo));
    await page.goto('/');
    await waitForHeaderButtons(page);
    const metrics = await collectHeaderMetrics(page);
    await attachHeaderArtifacts(page, testInfo, 'header-device');
    await testInfo.attach('metrics-device.json', {
      body: Buffer.from(JSON.stringify(metrics, null, 2)),
      contentType: 'application/json',
    });

    expect(metrics.buttons.length).toBeGreaterThanOrEqual(3);
    const rows = countDistinctRows(metrics.buttons);
    expect(rows).toBeGreaterThanOrEqual(2);

    const EDGE_TOLERANCE = 1;
    metrics.buttons.forEach((button) => {
      expect(button.left).toBeGreaterThanOrEqual(-EDGE_TOLERANCE);
      expect(button.right).toBeLessThanOrEqual(metrics.viewportWidth + 2);
    });

    if (metrics.status) {
      expect(metrics.status.right).toBeLessThanOrEqual(metrics.viewportWidth + EDGE_TOLERANCE);
    }
  });
});

test.describe('Drawing Functionality E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#glCanvas', { timeout: 10000 });
  });

  test('should enable drawing mode', async ({ page }) => {
    const overlayCanvas = page.locator('canvas#overlayCanvas');
    
    // Check cursor is crosshair (drawing mode)
    await expect(overlayCanvas).toHaveCSS('cursor', 'crosshair');
  });

  test('should draw ROI on canvas', async ({ page }, testInfo) => {
    test.skip(isMobileProject(testInfo), 'Pointer drawing relies on mouse input');
    const overlayCanvas = page.locator('canvas#overlayCanvas');
    
    // Get canvas bounding box
    const box = await overlayCanvas.boundingBox();
    if (!box) {
      test.skip();
      return;
    }
    
    const startX = box.x + box.width / 4;
    const startY = box.y + box.height / 4;
    const endX = box.x + box.width / 2;
    const endY = box.y + box.height / 2;

    await overlayCanvas.hover();
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY);
    await page.mouse.up();
    
    // Wait for ROI to be added
    await page.waitForTimeout(500);
    
    // Check status updated
    const status = page.locator('#status');
    await expect(status).not.toContainText('error');
  });
});

test.describe('Zoom and Pan E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#glCanvas', { timeout: 10000 });
  });

  test('should zoom with mouse wheel', async ({ page }, testInfo) => {
    test.skip(isMobileProject(testInfo), 'Mouse wheel not available on touch-only devices');
    const overlayCanvas = page.locator('canvas#overlayCanvas');
    
    // Get canvas center
    const box = await overlayCanvas.boundingBox();
    if (!box) {
      test.skip();
      return;
    }
    
    // Zoom in
    await overlayCanvas.hover();
    await page.mouse.wheel(0, -100);
    
    // Wait for zoom to apply
    await page.waitForTimeout(500);
    
    // Verify no errors
    const status = page.locator('#status');
    await expect(status).not.toContainText('error');
  });
});
