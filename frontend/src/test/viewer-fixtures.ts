import { expect, type Page } from '@playwright/test';

export async function ensureViewerReady(page: Page) {
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('button', { name: /classify/i })).toBeVisible();
}

export async function toggleHamburgerIfVisible(page: Page) {
  const menuButton = page.getByRole('button', { name: /menu/i }).first();
  if (await menuButton.isVisible()) {
    await menuButton.click();
  }
}
