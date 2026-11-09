import { expect, test, type Page } from '@playwright/test';
import { auditPost, auditProgram } from './support/fe8-audit';

async function guestFixture(page: Page, theme: 'dark' | 'light') {
  const calls: { method: string; path: string }[] = [];
  await page.addInitScript((mode) => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('gamerin_user_settings', JSON.stringify({ theme: mode }));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => undefined } });
  }, theme);
  await page.route('**/api/v1/**', (route) => {
    const method = route.request().method(); const path = new URL(route.request().url()).pathname;
    calls.push({ method, path });
    let data: unknown;
    const cursor = { items: [], nextCursor: null, hasNext: false };
    const paged = (content: unknown[]) => ({ content, number: 0, size: 10, totalElements: content.length, totalPages: content.length ? 1 : 0, first: true, last: true, empty: !content.length });
    const post = { ...auditPost, bookmarkedByMe: false };
    if (method === 'GET') {
      if (path === '/api/v1/feed' || path === '/api/v1/users/author/posts') data = { ...cursor, items: [post] };
      else if (path === '/api/v1/posts/by-number/1') data = post;
      else if (path === '/api/v1/posts/post-1/comments') data = [];
      else if (path === '/api/v1/users/author') data = { id: 'author', handle: 'author', nickname: '작성자', followersCount: 1, followingCount: 1, postCount: 1, gameStats: {} };
      else if (path === '/api/v1/users/author/media') data = cursor;
      else if (path === '/api/v1/games') data = [{ code: 'LOL', name: 'League of Legends' }];
      else if (path === '/api/v1/mentoring/programs') data = paged([auditProgram]);
      else if (path === '/api/v1/mentoring/programs/program-1') data = { ...auditProgram, mentorAbout: '멘토 소개' };
      else if (/\/mentoring\/mentors\/[^/]+\/reviews$/.test(path)) data = paged([]);
      else if (/\/mentoring\/mentors\/[^/]+$/.test(path)) data = { userId: auditProgram.mentorId, nickname: auditProgram.mentorNickname, status: 'ACTIVE', about: '멘토 소개', ratingAvg: 5, reviewCount: 0, menteeCount: 0 };
    }
    return route.fulfill(data === undefined ? { status: 401, json: { success: false, message: '로그인이 필요합니다.' } } : { status: 200, json: { success: true, data } });
  });
  return calls;
}

for (const theme of ['dark', 'light'] as const) {
  for (const width of [1440, 375, 320]) {
    test(`계정 화면 복귀와 멘토링 로그인 닫기 ${theme} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 1440 ? 1024 : 812 });
      await guestFixture(page, theme);
      await page.goto('/signup');
      await expect(page.getByRole('heading', { name: '회원가입', exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: '로그인', exact: true })).toHaveCount(0);
      await page.screenshot({ path: `/tmp/capstone-signup-${theme}-${width}.png`, fullPage: true });
      await page.getByLabel('필수 항목 전체 동의').check();
      await page.getByRole('button', { name: '다음', exact: true }).click();
      await expect(page.getByLabel('아이디', { exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: '로그인', exact: true })).toHaveCount(0);

      for (const path of ['/find-id', '/find-id-result?maskedHandle=vi***', '/auth/forgot-password', '/find-Password']) {
        await page.goto(path);
        const back = page.getByRole('link', { name: '홈으로 돌아가기' });
        await expect(back).toHaveAttribute('href', '/');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: `/tmp/capstone-account-${path.split('?')[0].replaceAll('/', '-')}-${theme}-${width}.png`, fullPage: true });
        await back.click();
        await expect(page).toHaveURL('/');
        await expect(page.getByRole('dialog', { name: '다시 오신 걸 환영해요' })).toHaveCount(0);
      }

      await page.goto('/mentoring');
      const dialog = page.getByRole('dialog', { name: '다시 오신 걸 환영해요' });
      for (const tabName of ['내 멘토링', '내 프로그램', '멘토 되기']) {
        const tab = page.getByRole('tab', { name: tabName, exact: true });
        await tab.click();
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('textbox', { name: '아이디', exact: true })).toBeFocused();
        if (tabName === '내 멘토링') await page.screenshot({ path: `/tmp/capstone-login-${theme}-${width}.png` });
        await dialog.getByRole('button', { name: '로그인 닫기' }).click();
        await expect(dialog).toHaveCount(0);
        await expect(tab).toBeFocused();
      }
      await page.getByRole('tab', { name: '내 멘토링', exact: true }).click();
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole('tab', { name: '내 멘토링', exact: true })).toBeFocused();
    });

    test(`게스트 공개 탐색과 중앙 로그인 모달 ${theme} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 1440 ? 1024 : 812 });
      const calls = await guestFixture(page, theme);
      await page.goto('/');
      await expect(page.getByText(auditPost.content, { exact: true })).toBeVisible();
      const like = page.getByRole('button', { name: '좋아요 2개' });
      await like.click();
      const dialog = page.getByRole('dialog', { name: '다시 오신 걸 환영해요' });
      await expect(dialog).toBeVisible();
      const box = await dialog.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(15); expect(box!.x + box!.width).toBeLessThanOrEqual(width - 15);
      const close = dialog.getByRole('button', { name: '로그인 닫기' });
      await close.focus(); await page.keyboard.press('Shift+Tab');
      await expect(dialog.getByRole('link', { name: '개인정보 처리방침' })).toBeFocused();
      await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(like).toBeFocused();
      await expect(page).toHaveURL('/');
      expect(calls.every((call) => call.method === 'GET' && !call.path.includes('/auth/'))).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}

test('보호 URL은 개인 API·개인 화면 없이 같은 모달을 띄우고 취소하면 공개 메인으로 복귀한다', async ({ page }) => {
  const calls = await guestFixture(page, 'dark');
  await page.goto('/wallet');
  await expect(page.getByRole('dialog', { name: '다시 오신 걸 환영해요' })).toBeVisible();
  expect(calls).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL('/');
  await expect(page.getByText(auditPost.content, { exact: true })).toBeVisible();
});

test('공개 상세와 프로필을 조회하고 게스트 링크 복사는 회원 API를 호출하지 않는다', async ({ page }) => {
  const calls = await guestFixture(page, 'dark');
  await page.goto('/posts/1?target=comments');
  await expect(page.getByRole('button', { name: '로그인하고 댓글 남기기' })).toBeVisible();
  await page.getByRole('button', { name: '게시글 공유' }).click();
  await page.getByRole('button', { name: '링크 복사' }).click();
  await expect(page.getByRole('button', { name: '복사 완료' })).toBeVisible();
  await page.goto('/profile/author');
  await expect(page.getByRole('button', { name: '팔로우', exact: true }).first()).toBeVisible();
  expect(calls.every((call) => call.method === 'GET' && !/\/auth\/|\/shares|\/messages/.test(call.path))).toBe(true);
});


test('게스트 멘토링 딥링크는 상세·후기·게임을 읽고 신청 전에 로그인 모달을 연다', async ({ page }) => {
  const calls = await guestFixture(page, 'dark');
  await page.goto('/mentoring?programId=program-1');
  await page.getByRole('button', { name: '로그인하고 신청하기' }).click();
  await expect(page.getByRole('dialog', { name: '다시 오신 걸 환영해요' })).toBeVisible();
  expect(calls.some((call) => call.path.endsWith('/reviews'))).toBe(true);
  expect(calls.some((call) => call.path === '/api/v1/games')).toBe(true);
  expect(calls.every((call) => call.method === 'GET' && !/\/mileage|\/mentors\/me|\/applications/.test(call.path))).toBe(true);
});
