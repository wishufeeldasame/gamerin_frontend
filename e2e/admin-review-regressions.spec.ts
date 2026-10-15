import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const accountA = { userId: '77777777-7777-4777-8777-777777777777', handle: 'review-a', nickname: '사용자 A', role: 'USER', status: 'ACTIVE' };
const accountB = { userId: '88888888-8888-4888-8888-888888888888', handle: 'review-b', nickname: '관리자 B', role: 'ADMIN', status: 'ACTIVE' };
type Account = typeof accountA;
const timestamp = '2026-10-08T00:00:00Z';

function paged<T>(content: T[], number = 0, totalPages = content.length ? 1 : 0, totalElements = content.length, size = 20) {
  return { content, number, totalPages, totalElements, size, first: number === 0, last: number >= totalPages - 1, empty: content.length === 0 };
}

function storedUser(account: Account) {
  return { id: account.userId, handle: account.handle, name: account.nickname, nickname: account.nickname, role: account.role, status: account.status, gameTier: 'Unranked' };
}

function report(account: Account) {
  return {
    id: account.userId, reportCode: account.userId === accountA.userId ? 'RPT-ACCOUNT-A' : 'RPT-ACCOUNT-B',
    reporterId: account.userId, targetType: 'POST', targetId: '99999999-9999-4999-8999-999999999999',
    targetSnippet: '본인이 접수한 신고', reasonCode: 'SPAM', reasonLabel: '스팸', details: null,
    status: 'RECEIVED', createdAt: timestamp, updatedAt: timestamp,
  };
}

async function mockBrowserSession(context: BrowserContext, initialAccount: Account = accountA) {
  let serverAccount = initialAccount;
  let refreshCount = 0;
  let logoutCount = 0;
  const reportRequests: { page: Page; userId: string | null }[] = [];
  // 이 BrowserContext의 모든 API를 가로채 실제 서버·운영 세션을 사용하지 않는다.
  await context.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const token = route.request().headers().authorization;
    const owner = token === 'Bearer review-token-a' ? accountA : token === 'Bearer review-token-b' ? accountB : null;
    const reply = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (path === '/api/v1/auth/login') {
      serverAccount = route.request().postDataJSON().handle === accountB.handle ? accountB : accountA;
      await route.fulfill({
        headers: { 'Set-Cookie': 'review_refresh=' + serverAccount.handle + '; Path=/; HttpOnly; SameSite=Lax' },
        json: { success: true, data: { userId: serverAccount.userId, accessToken: serverAccount.userId === accountA.userId ? 'review-token-a' : 'review-token-b' } },
      });
    } else if (path === '/api/v1/auth/refresh') {
      refreshCount += 1;
      await reply({ userId: serverAccount.userId, accessToken: serverAccount.userId === accountA.userId ? 'review-token-a' : 'review-token-b' });
    } else if (path === '/api/v1/auth/me') {
      await reply(owner);
    } else if (path === '/api/v1/auth/logout') {
      logoutCount += 1;
      await reply(null);
    } else if (path === '/api/v1/reports/my') {
      reportRequests.push({ page: route.request().frame().page(), userId: owner?.userId ?? null });
      if (!owner || owner.userId !== serverAccount.userId) {
        await route.fulfill({ status: 401, json: { success: false, message: '테스트 토큰 만료' } });
      } else {
        await reply(paged([report(owner)]));
      }
    } else if (path === '/api/v1/admin/dashboard/stats') {
      await reply({ receivedReportsCount: 0, inReviewReportsCount: 0, resolvedReportsCount: 0, rejectedReportsCount: 0, activePenaltiesCount: 0, hiddenContentsCount: 0 });
    } else if (path.endsWith('/bookmark-collections')) {
      await reply([]);
    } else if (path.endsWith('/unread-count')) {
      await reply({ unreadCount: 0 });
    } else if (path.startsWith('/api/v1/admin/')) {
      await reply(paged([]));
    } else {
      await reply([]);
    }
  });
  return { refreshCount: () => refreshCount, logoutCount: () => logoutCount, reportRequests };
}

async function seedAccount(page: Page, account: Account) {
  await page.goto('/admin/login');
  await page.evaluate((user) => localStorage.setItem('gamerin_user', JSON.stringify(user)), storedUser(account));
}

async function loginB(page: Page) {
  await page.goto('/admin/login');
  await page.locator('#admin-id').fill(accountB.handle);
  await page.locator('#admin-password').fill('synthetic-password');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function mockReportResync(page: Page) {
  const rows = [
    { ...report(accountA), id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', reportCode: 'RPT-RESYNC-1', reporterNickname: accountA.nickname, assignedAdminId: null, assignedAdminNickname: null },
    { ...report(accountA), id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', reportCode: 'RPT-RESYNC-2', reporterNickname: accountA.nickname, assignedAdminId: null, assignedAdminNickname: null },
  ];
  const patches: unknown[] = [];
  let failList = false;
  await page.route('**/api/v1/reports/reasons', (route) => route.fulfill({ json: { success: true, data: [{ code: 'SPAM', label: '스팸' }] } }));
  await page.route('**/api/v1/admin/reports**', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON();
      patches.push(body);
      const row = rows.find((item) => url.pathname.endsWith('/' + item.id + '/status'));
      if (!row) throw new Error('Unexpected mock report UUID');
      row.status = body.status;
      failList = true;
      await route.fulfill({ json: { success: true, data: row } });
    } else if (failList) {
      await route.fulfill({ status: 503, json: { success: false, message: '목록 조회 일시 실패' } });
    } else {
      const status = url.searchParams.get('status');
      const visible = rows.filter((row) => !status || row.status === status);
      await route.fulfill({ json: { success: true, data: paged(visible, 0, visible.length ? 1 : 0, visible.length, 5) } });
    }
  });
  return { patches, allowListRefresh: () => { failList = false; } };
}

for (const mode of [
  { name: 'desktop-light', width: 1440, height: 900, dark: false },
  { name: 'desktop-dark', width: 1440, height: 900, dark: true },
  { name: 'mobile-light', width: 390, height: 844, dark: false },
  { name: 'mobile-dark', width: 390, height: 844, dark: true },
]) {
  test('a committed status survives GET failure and only its row stays locked: ' + mode.name, async ({ page, context }) => {
    await mockBrowserSession(context, accountB);
    await seedAccount(page, accountB);
    const resync = await mockReportResync(page);
    await page.setViewportSize({ width: mode.width, height: mode.height });
    await page.goto('/admin/reports');
    await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), mode.dark);
    const changed = page.getByRole('combobox', { name: 'RPT-RESYNC-1 상태 변경' });
    const untouched = page.getByRole('combobox', { name: 'RPT-RESYNC-2 상태 변경' });
    await expect(changed).toHaveValue('접수');
    await changed.selectOption('처리 완료');
    await expect(changed).toHaveValue('처리 완료');
    await expect(changed).toBeDisabled();
    await expect(page.getByText('상태 변경은 완료됐지만 목록을 갱신하지 못했습니다. 새로고침해주세요.', { exact: true })).toBeVisible();
    await expect(untouched).toBeEnabled();
    expect(resync.patches).toEqual([{ status: 'RESOLVED' }]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    resync.allowListRefresh();
    await page.getByRole('button', { name: '새로고침', exact: true }).press('Enter');
    await expect(changed).toBeEnabled();
    await expect(changed).toHaveValue('처리 완료');
    await expect(page.getByText('상태 변경은 완료됐지만 목록을 갱신하지 못했습니다. 새로고침해주세요.', { exact: true })).toHaveCount(0);
    expect(resync.patches).toHaveLength(1);
  });
}

test('a committed report leaves its old status filter without another PATCH', async ({ page, context }) => {
  await mockBrowserSession(context, accountB);
  await seedAccount(page, accountB);
  const resync = await mockReportResync(page);
  await page.goto('/admin/reports');
  await expect(page.getByRole('combobox', { name: 'RPT-RESYNC-1 상태 변경' })).toBeEnabled();
  await page.getByRole('combobox', { name: '전체 상태', exact: true }).selectOption('접수');
  await expect(page.getByRole('button', { name: '새로고침', exact: true })).toBeEnabled();
  await page.getByRole('combobox', { name: 'RPT-RESYNC-1 상태 변경' }).selectOption('처리 완료');
  await expect(page.getByText('상태 변경은 완료됐지만 목록을 갱신하지 못했습니다. 새로고침해주세요.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'RPT-RESYNC-1', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'RPT-RESYNC-2 상태 변경' })).toBeEnabled();
  resync.allowListRefresh();
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(page.getByText('상태 변경은 완료됐지만 목록을 갱신하지 못했습니다. 새로고침해주세요.', { exact: true })).toHaveCount(0);
  expect(resync.patches).toEqual([{ status: 'RESOLVED' }]);
});

for (const missStorageEvent of [false, true]) {
  test(missStorageEvent ? 'refresh owner mismatch cannot retry my reports as the other account' : 'cross-tab account change clears only the old tab and survives reload', async ({ page, context }) => {
    const session = await mockBrowserSession(context);
    if (missStorageEvent) {
      await page.addInitScript(() => {
        // 저장 이벤트가 전달되지 않는 상황에서도 refresh 응답의 ID 검사로 격리되어야 한다.
        window.addEventListener('storage', (event) => {
          if (event.key === 'gamerin_user') event.stopImmediatePropagation();
        });
      });
    }
    await seedAccount(page, accountA);
    await page.goto('/reports/my');
    await expect(page.getByRole('cell', { name: 'RPT-ACCOUNT-A', exact: true })).toBeVisible();

    const secondPage = await context.newPage();
    await loginB(secondPage);
    if (missStorageEvent) {
      await expect(page.getByRole('cell', { name: 'RPT-ACCOUNT-A', exact: true })).toBeVisible();
      await page.getByRole('button', { name: '새로고침', exact: true }).click();
    }
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('RPT-ACCOUNT-A', { exact: true })).toHaveCount(0);
    await expect(page.getByText('RPT-ACCOUNT-B', { exact: true })).toHaveCount(0);
    expect(session.reportRequests.filter((request) => request.page === page && request.userId === accountB.userId)).toHaveLength(0);
    expect(session.logoutCount()).toBe(0);
    await expect(page.evaluate(() => JSON.parse(localStorage.getItem('gamerin_user') ?? '{}').id)).resolves.toBe(accountB.userId);
    expect((await context.cookies()).find((cookie) => cookie.name === 'review_refresh')?.value).toBe(accountB.handle);

    const refreshesBeforeReload = session.refreshCount();
    await page.reload();
    await expect(page.getByRole('heading', { name: '지금 가입하세요.' })).toBeVisible();
    expect(session.refreshCount()).toBe(refreshesBeforeReload);
    await secondPage.goto('/reports/my');
    await expect(secondPage.getByRole('cell', { name: 'RPT-ACCOUNT-B', exact: true })).toBeVisible();
    await expect(secondPage.getByText('RPT-ACCOUNT-A', { exact: true })).toHaveCount(0);
    expect(session.logoutCount()).toBe(0);

    // 기존 탭의 명시적 로그인 성공 후에는 재인증 표시가 해제되고 정상 복원이 가능하다.
    await loginB(page);
    await page.goto('/reports/my');
    await expect(page.getByRole('cell', { name: 'RPT-ACCOUNT-B', exact: true })).toBeVisible();
    await expect(secondPage.getByRole('cell', { name: 'RPT-ACCOUNT-B', exact: true })).toBeVisible();
    expect(session.logoutCount()).toBe(0);
  });
}

test('a late initial restoration cannot overwrite a newer login before its storage event arrives', async ({ page, context }) => {
  const session = await mockBrowserSession(context);
  await page.addInitScript(() => {
    window.addEventListener('storage', (event) => {
      if (event.key === 'gamerin_user') event.stopImmediatePropagation();
    });
  });
  await seedAccount(page, accountA);
  let finishMe: (() => void) | undefined;
  let meStarted = false;
  const pendingMe = new Promise<void>((resolve) => { finishMe = resolve; });
  await page.route('**/api/v1/auth/me', async (route) => {
    meStarted = true;
    await pendingMe;
    await route.fulfill({ json: { success: true, data: accountA } });
  });
  await page.goto('/reports/my');
  await expect.poll(() => meStarted).toBe(true);
  const secondPage = await context.newPage();
  await loginB(secondPage);
  finishMe?.();

  await expect(page).toHaveURL(/\/login$/);
  await expect(secondPage).toHaveURL(/\/admin$/);
  await expect(page.evaluate(() => JSON.parse(localStorage.getItem('gamerin_user') ?? '{}').id)).resolves.toBe(accountB.userId);
  await expect(page.getByText('RPT-ACCOUNT-A', { exact: true })).toHaveCount(0);
  await secondPage.goto('/reports/my');
  await expect(secondPage.getByRole('cell', { name: 'RPT-ACCOUNT-B', exact: true })).toBeVisible();
  expect(session.logoutCount()).toBe(0);
});

test('content restore refreshes the current page after keyboard pagination', async ({ page, context }) => {
  await mockBrowserSession(context, accountB);
  await seedAccount(page, accountB);
  const first = { id: 'hidden-row-0', targetType: 'POST', targetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', reportCount: 5, isHidden: true, updatedAt: timestamp };
  const second = { ...first, id: 'hidden-row-1', targetId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' };
  const requestedPages: number[] = [];
  let finishRestore: (() => void) | undefined;
  let restoreStarted = false;
  await page.route('**/api/v1/admin/contents/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/restore')) {
      expect(url.pathname).toBe('/api/v1/admin/contents/POST/' + first.targetId + '/restore');
      expect(route.request().method()).toBe('POST');
      restoreStarted = true;
      await new Promise<void>((resolve) => { finishRestore = resolve; });
      await route.fulfill({ json: { success: true, data: { ...first, isHidden: false } } });
    } else {
      const requestedPage = Number(url.searchParams.get('page'));
      requestedPages.push(requestedPage);
      await route.fulfill({ json: { success: true, data: paged([requestedPage === 0 ? first : second], requestedPage, 2, 21) } });
    }
  });
  await page.goto('/admin/content');
  await expect(page.getByText(first.targetId, { exact: true })).toBeVisible();
  // 개발 서버의 StrictMode 초기 GET 재실행과 복구 이후 재조회를 구분한다.
  const initialRequestCount = requestedPages.length;
  expect(requestedPages.every((requestedPage) => requestedPage === 0)).toBe(true);
  await page.getByRole('button', { name: '복구', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '콘텐츠 복구', exact: true }).click();
  await expect.poll(() => restoreStarted).toBe(true);
  // 기존 화면의 키보드 페이지 이동을 유지한 채 응답 경합을 검증한다.
  await page.getByRole('button', { name: '2', exact: true }).press('Enter');
  await expect(page.getByText(second.targetId, { exact: true })).toBeVisible();
  finishRestore?.();
  await expect.poll(() => requestedPages.slice(initialRequestCount)).toEqual([1, 1]);
  await expect(page.getByRole('button', { name: '2', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText(second.targetId, { exact: true })).toBeVisible();
  await expect(page.getByText(first.targetId, { exact: true })).toHaveCount(0);
});
