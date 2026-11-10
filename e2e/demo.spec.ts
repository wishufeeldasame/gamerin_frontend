import { expect, test } from '@playwright/test';

// 16:9 PC 와 4:3 아이패드 가로에서 전시 화면이 창을 꽉 채우고 스스로 재생되는지 본다.
for (const size of [{ width: 1920, height: 1080 }, { width: 1024, height: 768 }]) {
  test(`전시 소개 화면이 창을 채우고 재생된다 ${size.width}×${size.height}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize(size);
    await page.goto('/demo');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('함께 성장');
    const stage = page.locator('.ss-stage');
    await expect(stage).toBeVisible();
    const box = await stage.boundingBox();
    expect(Math.abs((box?.width ?? 0) - size.width)).toBeLessThanOrEqual(1);
    expect(Math.abs((box?.height ?? 0) - size.height)).toBeLessThanOrEqual(1);
    // 첫 챕터 카드가 지나가면 프로필 화면이 드러난다.
    await expect(page.locator('.sc-title')).not.toHaveAttribute('data-open', 'true', { timeout: 10_000 });
    await expect(page.locator('.sc-screen[data-on]')).toBeVisible();
    await page.mouse.click(size.width / 2, size.height / 2);
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
    expect(errors).toEqual([]);
  });
}
