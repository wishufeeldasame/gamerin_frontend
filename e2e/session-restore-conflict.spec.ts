import { expect, test, type Page } from '@playwright/test';
import { auditPost, auditUser, installAuditFixture } from './support/fe8-audit';

// #152: 앱 시작 refresh가 409·429를 받아도 유효한 세션의 탭을 로그인 화면으로 보내지 않는다.
const refreshOk = { success: true, data: { userId: auditUser.userId, accessToken: 'session-restore-token' } };

type RefreshReply = { status: number; json: unknown };

async function routeRefresh(page: Page, replies: RefreshReply[], calls: { count: number }) {
  // 나중에 등록한 route가 먼저 처리되므로 fixture의 refresh 응답을 덮어쓴다.
  await page.route('**/api/v1/auth/refresh', async (route) => {
    const reply = replies[Math.min(calls.count, replies.length - 1)];
    calls.count += 1;
    await route.fulfill({ status: reply.status, json: reply.json });
  });
}

test('같은 브라우저의 두 탭을 동시에 열 때 refresh 409를 받은 탭도 세션을 복원한다', async ({ context }) => {
  const calls = { count: 0 };
  // 첫 refresh는 성공, 같은 쿠키로 경합한 두 번째는 409, 그 뒤 새 쿠키로 다시 보낸 refresh는 성공한다.
  const replies: RefreshReply[] = [
    { status: 200, json: refreshOk },
    { status: 409, json: { success: false, message: '이미 갱신된 refresh 토큰입니다.' } },
    { status: 200, json: refreshOk },
  ];
  const tabs = [await context.newPage(), await context.newPage()];
  for (const tab of tabs) {
    await installAuditFixture(tab, 'light');
    await routeRefresh(tab, replies, calls);
  }

  await Promise.all(tabs.map((tab) => tab.goto('/')));

  for (const tab of tabs) {
    await expect(tab.getByText(auditPost.content.split(' ')[0]).first()).toBeVisible();
    await expect(tab).toHaveURL(/\/$/);
  }
  expect(calls.count).toBe(3);
});

test('refresh 429면 로그인 화면으로 보내지 않고, 자동 재시도 없이 다시 시도로 복원한다', async ({ page }) => {
  const calls = { count: 0 };
  await installAuditFixture(page, 'light');
  await routeRefresh(page, [
    { status: 429, json: { success: false, message: '요청이 너무 많습니다.' } },
    { status: 200, json: refreshOk },
  ], calls);

  await page.goto('/');

  await expect(page.getByRole('heading', { name: '로그인 상태를 확인하지 못했습니다' })).toBeVisible();
  await page.waitForTimeout(1_500);
  await expect(page).toHaveURL(/\/$/);
  expect(calls.count).toBe(1);

  await page.getByRole('button', { name: '다시 시도' }).click();

  await expect(page.getByText(auditPost.content.split(' ')[0]).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: '로그인 상태를 확인하지 못했습니다' })).toHaveCount(0);
  expect(calls.count).toBe(2);
});

test('refresh 401이면 세션을 끝내고 공개 탐색을 유지하며 회원 행동에서 로그인 모달을 연다', async ({ page }) => {
  const calls = { count: 0 };
  await installAuditFixture(page, 'light');
  await routeRefresh(page, [{ status: 401, json: { success: false, message: '인증이 필요합니다.' } }], calls);

  await page.goto('/');

  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '다시 오신 걸 환영해요' })).toBeVisible();
  expect(calls.count).toBe(1);
});
