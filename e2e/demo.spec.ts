import { expect, test } from '@playwright/test';

// 데스크톱과 모바일 폭에서 소개 페이지가 라이트 바탕 위에 영상·소개·푸터를 놓고, 영상이 스스로 재생되는지 본다.
for (const size of [{ width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
  test(`소개 페이지가 영상과 푸터를 보여 준다 ${size.width}×${size.height}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize(size);
    await page.goto('/demo');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('게임 밖에서도');
    const stage = page.locator('.ss-stage');
    await expect(stage).toBeVisible();
    // 영상은 창을 꽉 채우지 않고 16:9 로 본문 폭 안에 놓인다.
    const box = await stage.boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(Math.min(size.width - 32, 1120) + 1);
    expect(Math.abs((box?.width ?? 0) / (box?.height ?? 1) - 16 / 9)).toBeLessThan(0.02);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // 첫 챕터 카드가 지나가면 프로필 화면이 드러난다.
    await expect(page.locator('.sc-title')).not.toHaveAttribute('data-open', 'true', { timeout: 10_000 });
    await expect(page.locator('.sc-screen[data-on]')).toBeVisible();
    await expect(page.getByRole('heading', { name: '서비스 소개' })).toBeVisible();
    const shortcut = page.getByRole('contentinfo').getByRole('link', { name: 'GamerIN 바로가기' });
    await expect(shortcut).toHaveAttribute('href', '/');
    expect(errors).toEqual([]);
  });
}
