import { expect, test } from '@playwright/test';

for (const size of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
  test(`실제 화면 전시·정적 소개·화면 맞춤 ${size.width}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/demo');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('함께 성장');
    await expect(page.getByText('실제 서비스 화면 녹화 · 데이터는 예시')).toBeVisible();
    await expect(page.getByText('모션 줄이기 · 정적 소개')).toBeVisible();
    await expect(page.locator('.ex-film')).toHaveJSProperty('paused', true);
    await expect(page.locator('.ex-cover')).toHaveAttribute('data-open', 'true');
    await expect(page.getByRole('button', { name: '전체화면', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => ({ horizontal: document.documentElement.scrollWidth > innerWidth, vertical: document.documentElement.scrollHeight > innerHeight }))).toEqual({ horizontal: false, vertical: false });
  });
}

test('60초 실제 녹화·무음·정지·재개·반복·처음부터', async ({ page }) => {
  test.setTimeout(40_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/demo');
  const video = page.locator('.ex-film');
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0.2);
  expect(await video.evaluate((element: HTMLVideoElement) => element.duration)).toBeCloseTo(60, 0);
  await expect(video).toHaveJSProperty('muted', true);
  await expect(video).toHaveJSProperty('loop', true);
  await page.getByRole('button', { name: '일시정지', exact: true }).click();
  await expect(video).toHaveJSProperty('paused', true);
  const time = await video.evaluate((element: HTMLVideoElement) => element.currentTime);
  await page.waitForTimeout(700);
  expect(await video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBe(time);
  await page.getByRole('button', { name: '재생', exact: true }).click();
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(time + 0.1);
  for (const seconds of [7, 16, 28, 38, 47, 52]) {
    await video.evaluate(async (element: HTMLVideoElement, seconds) => {
      await new Promise<void>((resolve) => { element.addEventListener('seeked', () => resolve(), { once: true }); element.currentTime = seconds; });
    }, seconds);
    await page.waitForTimeout(100);
    await expect(page.locator('.ex-cover')).toHaveAttribute('data-open', 'false');
    await page.screenshot({ path: test.info().outputPath(`actual-${seconds}.png`) });
  }
  await video.evaluate((element: HTMLVideoElement) => { element.currentTime = 59.7; });
  await expect(page.locator('.ex-cover')).toHaveAttribute('data-open', 'true');
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeLessThan(2);
  await page.getByRole('button', { name: '처음부터', exact: true }).click();
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeLessThan(1);
  expect(errors).toEqual([]);
});

test('영상 장애·키보드 제어·전체화면 거절 안내', async ({ page }) => {
  await page.route('**/demo-assets/exhibition.mp4', (route) => route.abort());
  await page.goto('/demo');
  await expect(page.getByRole('status')).toContainText('소개 영상을 불러오지 못했어요.');
  await expect(page.locator('.ex-film-poster')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'GamerIN 소개 페이지' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '일시정지', exact: true })).toBeFocused();
  await page.evaluate(() => { document.querySelector('main')!.requestFullscreen = () => Promise.reject(new Error('테스트용 거절')); });
  await page.getByRole('button', { name: '전체화면', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('전체화면을 열 수 없어요.');
});
