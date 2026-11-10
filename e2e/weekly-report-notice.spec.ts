import { expect, test } from '@playwright/test';

test('guest can open the preview without requesting a private weekly report', async ({ page }) => {
  let weeklyCalls = 0;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/memberships/weekly-report') weeklyCalls++;
    await route.fulfill({ status: 401, json: { success: false, message: '로그인이 필요합니다.' } });
  });
  await page.goto('/membership/content');
  await expect(page.getByRole('button', { name: '로그인하고 확인하기' })).toBeVisible();
  await page.getByRole('link', { name: '예시 리포트 미리보기' }).click();
  await expect(page.getByText(/주간 전적과 AI 분석은 예시 데이터입니다/)).toBeVisible();
  expect(weeklyCalls).toBe(0);
});

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1100 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`member reads a partial weekly report and can open the separate preview on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const member = {
      userId: '11111111-1111-1111-1111-111111111111', handle: 'member', nickname: 'Member',
      role: 'ROLE_USER', status: 'ACTIVE',
    };
    await page.addInitScript((user) => {
      localStorage.setItem('gamerin_user', JSON.stringify({
        id: user.userId, name: user.nickname, nickname: user.nickname, handle: user.handle,
        role: user.role, status: user.status, gameTier: '',
      }));
    }, member);
    const notice = '일부 경기 정보를 불러오지 못했어요. 확인된 경기만으로 작성해 실제 기록과 차이가 있을 수 있어요.';
    const report = {
      weekStart: '2026-11-02', weekEnd: '2026-11-08', previousWeekStart: '2026-10-26', previousWeekEnd: '2026-11-01',
      totalMatches: 4, notice,
      games: [{
        game: 'VALORANT', gameLabel: '발로란트', matches: 4, winRate: 50, kd: 1.57, headshotRate: 19.9,
        tierLabel: '다이아몬드 2', previousWeek: null,
        analysis: { headline: '확인된 4경기 기준 분석', summary: '확인된 경기의 전적을 요약했습니다.', focus: '다음 주 플레이를 돌아보세요.' },
      }],
    };
    let weeklyCalls = 0;
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/v1/auth/refresh') {
        await route.fulfill({ json: { success: true, data: { ...member, accessToken: 'e2e-member-token' } } });
      } else if (path === '/api/v1/auth/me') {
        await route.fulfill({ json: { success: true, data: member } });
      } else if (path === '/api/v1/memberships/weekly-report') {
        weeklyCalls++;
        expect(route.request().method()).toBe('GET');
        expect(route.request().headers().authorization).toBe('Bearer e2e-member-token');
        await route.fulfill({ json: { success: true, data: report } });
      } else {
        await route.fulfill({ status: 404, json: { success: false, message: '테스트에서 사용하지 않는 API입니다.' } });
      }
    });

    await page.goto('/membership/content');

    await expect(page.getByText(notice, { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: report.games[0].analysis.headline })).toBeVisible();
    await expect(page.getByText('1.57', { exact: true })).toBeVisible();
    await expect(page.getByText('확인된 경기', { exact: true })).toBeVisible();
    await expect(page.getByText(/HTTP 404|HenrikDev|경기 ID/)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `/private/tmp/gamerin-member-weekly-notice-${viewport.name}.png`, fullPage: true });
    const beforePreview = weeklyCalls;
    await page.getByRole('link', { name: '예시 리포트 미리보기' }).click();

    await expect(page).toHaveURL(/\/membership\/content-preview$/);
    await expect(page.getByText(/주간 전적과 AI 분석은 예시 데이터입니다/)).toBeVisible();
    await expect(page.getByRole('heading', { name: '리그 오브 레전드', exact: true })).toBeVisible();
    expect(weeklyCalls).toBe(beforePreview);
  });
}
