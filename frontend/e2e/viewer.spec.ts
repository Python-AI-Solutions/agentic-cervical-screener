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
    await page.evaluate(() => {
      const el = document.getElementById('sidebar');
      el?.classList.add('mobile-visible');
    });
    await page.waitForTimeout(200);
  }
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
    
    // Click menu button - use force click to bypass pointer interception
    // The button might be covered by an overlay or other element
    const menuButton = page.locator('#mobileMenuBtn');
    await menuButton.scrollIntoViewIfNeeded();
    await menuButton.click({ force: true });
    
    // Wait for animation/transition and CSS class application
    await page.waitForTimeout(1000);
    
    // Check if mobile-visible class was added
    const hasMobileVisible = await sidebar.evaluate((el) => {
      return el.classList.contains('mobile-visible');
    });
    
    // If class wasn't added, the click might not have worked
    if (!hasMobileVisible) {
      // Try clicking again with a different approach
      await page.evaluate(() => {
        const btn = document.getElementById('mobileMenuBtn');
        if (btn) btn.click();
      });
      await page.waitForTimeout(1000);
    }
    
    // Sidebar should now be visible (x position should be 0 or positive)
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
