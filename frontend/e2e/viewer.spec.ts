import { test, expect } from '@playwright/test';

/**
 * E2E tests using Playwright
 * These tests run in a real browser and test actual functionality
 * Use these for tests that require:
 * - Real DOM rendering
 * - Canvas operations
 * - Image loading
 * - User interactions
 * - Full application workflows
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

  test('should load Case 2 when clicking button', async ({ page }) => {
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
  test('should load all demo cases', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#viewer', { timeout: 5000 });
    
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
    
    // Click menu button
    await page.click('#mobileMenuBtn');
    
    // Wait for animation/transition
    await page.waitForTimeout(500);
    
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

  test('should draw ROI on canvas', async ({ page }) => {
    const overlayCanvas = page.locator('canvas#overlayCanvas');
    
    // Get canvas bounding box
    const box = await overlayCanvas.boundingBox();
    if (!box) {
      test.skip();
      return;
    }
    
    // Draw a rectangle
    await overlayCanvas.hover();
    await page.mouse.move(box.x + box.width / 4, box.y + box.height / 4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
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

  test('should zoom with mouse wheel', async ({ page }) => {
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

