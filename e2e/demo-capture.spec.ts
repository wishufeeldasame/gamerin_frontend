import { expect, test } from '@playwright/test';
import { installDemoCapture } from './support/demo-capture';

test('전시 촬영용 실제 페이지 확인', async ({ page }, info) => {
  const { state } = await installDemoCapture(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/profile/viewer');
  await page.getByRole('tab', { name: '전적', exact: true }).click();
  await expect(page.getByRole('button', { name: '전적 추가', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('01-profile.png') });
  state.posted = true;
  await page.goto('/');
  const video = page.locator('article video').first();
  await expect(video).toBeVisible();
  await video.evaluate(async (element: HTMLVideoElement) => { element.muted = true; await element.play(); });
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0.3);
  await page.screenshot({ path: info.outputPath('02-feed-playing.png') });
  await page.goto('/mentoring?programId=program-1');
  await expect(page.getByText('클러치 판단과 포지셔닝', { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('03-mentoring.png') });
  state.shared = true;
  state.feedback = true;
  await page.goto('/messages');
  await page.getByRole('region', { name: '대화 목록' }).getByRole('button', { name: /클러치코치/ }).click();
  await expect(page.getByRole('region', { name: '메시지 대화' }).getByText('에임은 좋아요. 다음엔 엄폐물 쪽으로 한 발 물러나 각을 하나씩 확인해보세요.', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('04-messages.png') });
});
