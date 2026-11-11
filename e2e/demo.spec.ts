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
    const header = page.getByRole('banner');
    const download = header.getByRole('button', { name: '다운로드', exact: true });
    const shortcut = header.getByRole('link', { name: 'GamerIN 바로가기' });
    await expect(download).toBeVisible();
    await expect(shortcut).toHaveAttribute('href', '/');
    const [downloadBox, shortcutBox] = await Promise.all([download.boundingBox(), shortcut.boundingBox()]);
    expect(downloadBox?.x).toBeLessThan(shortcutBox?.x ?? 0);
    expect(Math.abs((downloadBox?.y ?? 0) - (shortcutBox?.y ?? 0))).toBeLessThan(4);
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('link', { name: 'GamerIN 바로가기' })).toHaveAttribute('href', '/');
    await expect(footer.getByRole('button', { name: '다운로드', exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('홈에서 받은 웹앱 설치 요청을 소개 페이지에서 한 번만 사용한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/api/v1/auth/refresh', (route) => route.fulfill({ status: 401 }));
  await page.route('**/api/v1/feed**', (route) => route.fulfill({
    json: { success: true, data: { items: [], nextCursor: null, hasNext: false } },
  }));
  await page.goto('/');
  const demoLink = page.getByRole('link', { name: '© 2026 GamerIN' });
  await expect(demoLink).toBeVisible();
  await page.evaluate(() => {
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: async () => { document.body.dataset.installPrompted = 'true'; },
    });
    window.dispatchEvent(event);
  });
  await demoLink.click();
  await expect(page).toHaveURL(/\/demo$/);

  const header = page.getByRole('banner');
  const install = header.getByRole('button', { name: '다운로드', exact: true });
  const guide = page.getByRole('link', { name: '설치 방법 보기' });
  await install.click();
  await expect(page.locator('body')).toHaveAttribute('data-install-prompted', 'true');
  await expect(guide).toHaveCount(0);
  await install.click();
  await expect(guide).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(install).toHaveCount(0);
  await expect(header.getByRole('link', { name: 'GamerIN 바로가기' })).toBeVisible();
});

test('웹앱 시작 주소와 이전 바로가기가 홈으로 연결된다', async ({ page }) => {
  await page.route('**/api/v1/auth/refresh', (route) => route.fulfill({ status: 401 }));
  const manifest = await page.request.get('/manifest.webmanifest');
  expect(await manifest.json()).toMatchObject({ id: '/', start_url: '/' });

  const response = await page.goto('/login');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('dialog').getByRole('button', { name: '로그인 닫기' })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);

  expect((await page.goto('/home'))?.status()).toBe(200);
  await expect(page).toHaveURL(/\/$/);
});
