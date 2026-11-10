import { expect, test, type Page, type Route } from '@playwright/test';

const activeAdmin = {
  userId: '11111111-1111-1111-1111-111111111111',
  handle: 'admin',
  nickname: 'Admin',
  role: 'ROLE_ADMIN',
  status: 'ACTIVE',
};

async function mockAuth(page: Page) {
  await page.route('**/api/v1/auth/**', async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/login') || path.endsWith('/refresh')) {
      await route.fulfill({
        json: { success: true, data: { ...activeAdmin, accessToken: 'e2e-token' } },
      });
      return;
    }
    if (path.endsWith('/me')) {
      await route.fulfill({ json: { success: true, data: activeAdmin } });
      return;
    }
    await route.fulfill({ json: { success: true, data: null } });
  });
}

async function seedAdmin(page: Page) {
  await page.addInitScript((admin) => {
    window.localStorage.setItem(
      'gamerin_user',
      JSON.stringify({
        id: admin.userId,
        name: admin.nickname,
        nickname: admin.nickname,
        gameTier: '',
        handle: admin.handle,
        role: admin.role,
        status: admin.status,
      }),
    );
  }, activeAdmin);
}

async function mockEmptyAdminReports(page: Page) {
  await page.route('**/api/v1/admin/dashboard/stats', (route) => route.fulfill({ json: { success: true, data: { receivedReportsCount: 0, inReviewReportsCount: 0, resolvedReportsCount: 0, rejectedReportsCount: 0, activePenaltiesCount: 0, hiddenContentsCount: 0 } } }));
  await page.route('**/api/v1/admin/reports**', async (route) => {
    if (new URL(route.request().url()).pathname !== '/api/v1/admin/reports') {
      await route.fulfill({ status: 404, json: { success: false, message: '테스트에서 정의하지 않은 신고 상세 요청입니다.' } });
      return;
    }
    await route.fulfill({
      json: {
        success: true,
        data: {
          content: [],
          totalPages: 0,
          totalElements: 0,
          number: 0,
          size: 10,
          first: true,
          last: true,
          empty: true,
        },
      },
    });
  });
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1100 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`admin generates a weekly report from the sidebar on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await seedAdmin(page);
    await mockAuth(page);
    await mockEmptyAdminReports(page);
    const report = {
      weekStart: '2026-11-02', weekEnd: '2026-11-08',
      previousWeekStart: '2026-10-26', previousWeekEnd: '2026-11-01',
      totalMatches: 9,
      games: [{
        game: 'VALORANT', gameLabel: '발로란트', matches: 9, winRate: 66.7,
        kd: null, headshotRate: 24.6, tierLabel: null, previousWeek: null,
        analysis: { headline: '이번 주 경기 분석', summary: '경기 기록을 바탕으로 생성한 요약입니다.', focus: '다음 경기의 교전 위치를 점검해 보세요.' },
      }],
      notice: '일부 경기 정보를 불러오지 못했어요. 확인된 경기만으로 작성해 실제 기록과 차이가 있을 수 있어요.',
      collectionIssues: [{
        matchId: 'unavailable-match', startedAt: '2026-11-02T15:27:02.659Z', map: 'Lotus', httpStatus: 404,
        reason: '랭크 이력에는 있지만 HenrikDev 경기 상세 API에서 경기 정보를 찾을 수 없습니다.',
      }],
    };
    let finishGeneration!: () => void;
    const pending = new Promise<void>((resolve) => { finishGeneration = resolve; });
    let submitted: unknown;
    let calls = 0;
    await page.route('**/api/v1/admin/weekly-reports/valorant', async (route) => {
      calls++;
      submitted = route.request().postDataJSON();
      expect(route.request().method()).toBe('POST');
      expect(route.request().headers().authorization).toBe('Bearer e2e-token');
      await pending;
      await route.fulfill({ json: { success: true, data: report } });
    });

    await page.goto('/admin/reports');
    if (viewport.name === 'mobile') await page.getByRole('button', { name: '관리자 메뉴 열기' }).click();
    await page.getByRole('link', { name: '주간 전적 리포트' }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/admin\/weekly-reports$/);
    await expect(page.getByText('아직 실행한 요청이 없습니다.')).toBeVisible();
    await page.getByRole('combobox', { name: '리전', exact: true }).selectOption('AP');
    await page.getByLabel('닉네임 (이름#태그)').fill('플레이어#TAG');
    await page.getByRole('button', { name: '실행 · 리포트 생성' }).click();

    await expect(page.getByText('리포트를 생성하고 있습니다.')).toBeVisible();
    await expect(page.getByRole('button', { name: '생성 중...' })).toBeDisabled();
    await expect(page.getByRole('combobox', { name: '리전', exact: true })).toBeDisabled();
    await expect.poll(() => submitted).toEqual({ riotId: '플레이어#TAG', region: 'AP' });
    finishGeneration();

    await expect(page.getByText('HTTP 200')).toBeVisible();
    await expect(page.getByRole('heading', { name: '경기 수집 안내' })).toBeVisible();
    await expect(page.getByText(/Lotus · HTTP 404/)).toBeVisible();
    expect(JSON.parse((await page.getByLabel('응답 JSON').textContent())!)).toEqual(report);
    expect(calls).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `/private/tmp/gamerin-admin-weekly-report-${viewport.name}.png`, fullPage: true });
  });
}

test('guard redirects an unauthenticated visitor to admin login', async ({ page }) => {
  await page.goto('/admin/reports');
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test('admin can log in and log out with server session cleanup', async ({ page }) => {
  await mockAuth(page);
  await mockEmptyAdminReports(page);

  await page.goto('/admin/login');
  await page.locator('#admin-id').fill('admin');
  await page.locator('#admin-password').fill('password');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.evaluate(() => localStorage.getItem('gamerin_user'))).resolves.toBeNull();
});

test('admin API 403 opens the forbidden page without clearing the session', async ({ page }) => {
  await seedAdmin(page);
  await mockAuth(page);
  await page.route('**/api/v1/admin/reports**', async (route) => {
    await route.fulfill({
      status: 403,
      json: { success: false, message: 'Forbidden' },
    });
  });

  await page.goto('/admin/reports');
  await expect(page).toHaveURL(/\/admin\/forbidden$/);
  await expect(page.evaluate(() => localStorage.getItem('gamerin_user'))).resolves.not.toBeNull();
});

test('admin API 401 clears the session and opens the admin login page', async ({ page }) => {
  await seedAdmin(page);
  await mockAuth(page);
  await page.route('**/api/v1/admin/reports**', async (route) => {
    await route.fulfill({
      status: 401,
      json: { success: false, message: 'Unauthorized' },
    });
  });

  await page.goto('/admin/reports');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.evaluate(() => localStorage.getItem('gamerin_user'))).resolves.toBeNull();
});

test('a delayed logout prevents a new admin login until cleanup completes', async ({ page }) => {
  let finishLogout: (() => void) | undefined;
  await page.route('**/api/v1/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/logout')) {
      await new Promise<void>((resolve) => {
        finishLogout = resolve;
      });
      await route.fulfill({ json: { success: true, data: null } });
      return;
    }
    if (path.endsWith('/login') || path.endsWith('/refresh')) {
      await route.fulfill({
        json: { success: true, data: { ...activeAdmin, accessToken: 'e2e-token' } },
      });
      return;
    }
    await route.fulfill({ json: { success: true, data: activeAdmin } });
  });
  await mockEmptyAdminReports(page);

  await page.goto('/admin/login');
  await page.locator('#admin-id').fill('admin');
  await page.locator('#admin-password').fill('password');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole('button', { name: '이전 세션 정리 중...' })).toBeDisabled();

  finishLogout?.();
  await expect(page.getByRole('button', { name: '로그인' })).toBeEnabled();
});

test('logout in one admin tab is synchronized to another tab', async ({ page, context }) => {
  await mockAuth(page);
  await mockEmptyAdminReports(page);
  await page.goto('/admin/login');
  await page.locator('#admin-id').fill('admin');
  await page.locator('#admin-password').fill('password');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/admin$/);

  const secondPage = await context.newPage();
  await mockAuth(secondPage);
  await mockEmptyAdminReports(secondPage);
  await secondPage.goto('/admin/reports');
  await expect(secondPage).toHaveURL(/\/admin\/reports$/);

  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(secondPage).toHaveURL(/\/admin\/login$/);
  await expect(
    secondPage.evaluate(() => localStorage.getItem('gamerin_user')),
  ).resolves.toBeNull();
});
