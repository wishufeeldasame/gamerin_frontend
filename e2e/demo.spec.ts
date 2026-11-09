import { expect, test } from '@playwright/test';

for (const size of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
  test(`전시 공개 접근·정적 소개·화면 맞춤 ${size.width}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const writes: string[] = [];
    page.on('request', (request) => { if (request.url().includes('/api/v1/') && request.method() !== 'GET') writes.push(request.method()); });
    await page.route('**/api/v1/**', (route) => route.fulfill({ status: 503, json: { success: false, message: '테스트용 장애' } }));
    await page.goto('/demo');
    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('함께 성장');
    await expect(page.getByText('모션 줄이기 · 정적 소개')).toBeVisible();
    await expect(page.locator('.ex-cover')).toHaveAttribute('data-open', 'true');
    await expect(page.getByRole('button', { name: '전체화면', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => ({ horizontal: document.documentElement.scrollWidth > innerWidth, vertical: document.documentElement.scrollHeight > innerHeight }))).toEqual({ horizontal: false, vertical: false });
    expect(writes).toEqual([]);
  });
}

test('일시정지·재개·처음부터', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.locator('.ex-time')).not.toHaveText('00 / 60', { timeout: 10_000 });
  await page.getByRole('button', { name: '일시정지', exact: true }).click();
  const time = await page.locator('.ex-time').textContent();
  await page.waitForTimeout(1200);
  await expect(page.locator('.ex-time')).toHaveText(time!);
  await page.getByRole('button', { name: '재생', exact: true }).click();
  await expect(page.locator('.ex-time')).not.toHaveText(time!);
  await page.getByRole('button', { name: '처음부터' }).click();
  await expect(page.locator('.ex-time')).toHaveText('00 / 60');
  await expect(page.locator('.ex-cover')).toHaveAttribute('data-open', 'true');
});
