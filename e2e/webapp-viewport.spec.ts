import { expect, test } from '@playwright/test';
import { installAuditFixture } from './support/fe8-audit';

for (const theme of ['light', 'dark'] as const) {
  test(`설치 앱 기본 상태바와 불투명 상단 ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installAuditFixture(page, theme);
    await page.goto('/');
    await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute('content', 'default');
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    const header = page.locator('[data-mobile-top-bar]');
    await expect(header).toBeVisible();
    await expect(header).toHaveCSS('filter', 'none');
    await expect(header).toHaveCSS('backdrop-filter', 'none');
    await expect(header).toHaveCSS('background-color', theme === 'dark' ? 'rgb(25, 25, 29)' : 'rgb(250, 250, 250)');
    const heading = await header.getByRole('link', { name: 'GamerIN' }).boundingBox();
    expect(heading!.y).toBeGreaterThanOrEqual(0);
    expect(heading!.y + heading!.height).toBeLessThanOrEqual(844);
  });
}
