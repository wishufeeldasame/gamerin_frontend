import { expect, test, type Page } from '@playwright/test';

test.use({ timezoneId: 'Asia/Seoul' });

const adminId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';
const reportId = '33333333-3333-4333-8333-333333333333';
const penaltyId = '44444444-4444-4444-8444-444444444444';
const userId = '55555555-5555-4555-8555-555555555555';
const timestamp = '2026-10-01T00:00:00Z';
const reportBase = { id: reportId, reportCode: 'RPT-INTEGRATION', reporterId: userId, reporterNickname: '신고자', targetType: 'POST', targetId: '66666666-6666-4666-8666-666666666666', targetSnippet: '신고 당시 게시물 요약', reasonCode: 'SPAM', reasonLabel: '스팸', details: '반복적인 광고', assignedAdminId: null, assignedAdminNickname: null, createdAt: timestamp, updatedAt: timestamp };
function paged<T>(items: T[], size = 20) { return { content: items, totalPages: items.length ? 1 : 0, totalElements: items.length, number: 0, size, first: true, last: true, empty: items.length === 0 }; }

async function session(page: Page, role: 'ADMIN' | 'USER' = 'ADMIN') {
  const account = { userId: role === 'ADMIN' ? adminId : userId, handle: role === 'ADMIN' ? 'admin' : 'reporter', nickname: role === 'ADMIN' ? '관리자' : '신고자', role: 'ROLE_' + role, status: 'ACTIVE' };
  await page.addInitScript((value) => localStorage.setItem('gamerin_user', JSON.stringify({ id: value.userId, handle: value.handle, name: value.nickname, nickname: value.nickname, role: value.role, status: value.status, gameTier: '' })), account);
  await page.route('**/api/v1/auth/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: { success: true, data: path.endsWith('/refresh') ? { userId: account.userId, accessToken: 'integration-test-token' } : path.endsWith('/logout') ? null : account } });
  });
}

for (const screenMode of [
  { name: 'desktop-light', width: 1440, height: 900, dark: false },
  { name: 'desktop-dark', width: 1440, height: 900, dark: true },
  { name: 'mobile-light', width: 390, height: 844, dark: false },
  { name: 'mobile-dark', width: 390, height: 844, dark: true },
]) {
  test('admin screens stay within the viewport with actual contract fixtures: ' + screenMode.name, async ({ page }) => {
    test.setTimeout(90000);
    await session(page);
    await adminRoutes(page);
    await page.setViewportSize({ width: screenMode.width, height: screenMode.height });
    await page.emulateMedia({ colorScheme: screenMode.dark ? 'dark' : 'light' });
    for (const [path, heading, marker] of [
      ['/admin', '대시보드', '처리 완료 상태 신고'],
      ['/admin/users', '사용자 관리', '@target'],
      ['/admin/reports', '신고 관리', '신고 당시 게시물 요약'],
      ['/admin/reports/RPT-INTEGRATION', '신고 상세', '신고 당시 내용 요약'],
      ['/admin/users/target', '사용자 상세', '제재 관리'],
      ['/admin/content', '숨김 콘텐츠 관리', '숨김'],
      ['/admin/audit-logs', '작업 이력', '신고 판정 완료: 반복적인 광고'],
      ['/admin/mentoring', '멘토링 관리', '멘토 소개'],
      ['/admin/settings', '시스템 설정', '신고 누적 시 자동 숨김'],
    ]) {
      await page.goto(path);
      await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), screenMode.dark);
      await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
      await expect(page.getByText(marker, { exact: true }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
    }
    await page.goto('/admin/mentoring');
    await page.getByRole('tab', { name: '프로그램 관리' }).click();
    await expect(page.getByText('멘토 프로그램', { exact: true })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: '프로그램 제목 또는 멘토 닉네임 검색' })).toHaveAttribute('placeholder', '제목 · 멘토 닉네임 검색');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

async function adminRoutes(page: Page, targetRole: 'USER' | 'ADMIN' = 'USER') {
  let status = 'RECEIVED';
  let hidden = false;
  let active = false;
  const bodies: unknown[] = [];
  const summary = { id: targetId, nickname: '대상 사용자', handle: 'target', joinedAt: timestamp, reportsReceived: 2, activeSanction: '없음' };
  const user = () => ({ id: targetId, handle: 'target', nickname: '대상 사용자', email: 'target@example.invalid', profileImageUrl: null, role: targetRole, status: active ? 'SUSPENDED' : 'ACTIVE', createdAt: timestamp, reportsReceivedCount: 2, activeSanction: active ? '3일 정지' : '없음', activePenaltyId: active ? penaltyId : null });
  const penalty = () => ({ id: penaltyId, userId: targetId, userNickname: '대상 사용자', reportId, penaltyType: 'SUSPENSION_3D', reason: '반복적인 광고', startAt: timestamp, endAt: '2026-10-11T00:00:00Z', isActive: active, administeredByAdminId: adminId, administeredByAdminNickname: '관리자', createdAt: timestamp });
  const detail = () => ({ report: { ...reportBase, status }, reporter: { ...summary, id: userId, nickname: '신고자', handle: 'reporter' }, targetUser: summary, contentHidden: hidden });
  await page.route('**/api/v1/admin/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    let data: unknown;
    if (path === '/api/v1/admin/reports') data = paged([{ ...reportBase, status }], 5);
    else if (path.endsWith('/RPT-INTEGRATION/detail')) data = detail();
    else if (path.endsWith('/RPT-INTEGRATION/start-review')) { status = 'IN_REVIEW'; data = detail(); }
    else if (path.endsWith('/RPT-INTEGRATION/resolve')) {
      bodies.push(route.request().postDataJSON());
      status = 'RESOLVED'; hidden = true; active = true; data = detail();
    } else if (path === '/api/v1/admin/users') data = paged([user()], 6);
    else if (path === '/api/v1/admin/users/by-handle/target' || path === '/api/v1/admin/users/' + targetId) data = user();
    else if (path === '/api/v1/admin/users/' + targetId + '/penalties/' + penaltyId && method === 'DELETE') { active = false; data = penalty(); }
    else if (path === '/api/v1/admin/users/' + targetId + '/penalties') data = paged(status === 'RESOLVED' ? [penalty()] : [], Number(url.searchParams.get('size') ?? 20));
    else if (path === '/api/v1/admin/audit-logs') data = paged([{ id: 'audit-id', adminId, adminNickname: '관리자', actionType: 'REPORT_RESOLVE', targetType: 'POST', targetId: reportBase.targetId, requestId: null, details: '신고 판정 완료: 반복적인 광고', createdAt: timestamp }]);
    else if (path === '/api/v1/admin/dashboard/stats') data = { receivedReportsCount: 1, inReviewReportsCount: 0, resolvedReportsCount: 3, rejectedReportsCount: 1, activePenaltiesCount: 2, hiddenContentsCount: 1 };
    else if (path === '/api/v1/admin/contents/hidden') data = paged([{ id: 'hidden-id', targetType: 'POST', targetId: reportBase.targetId, reportCount: 5, isHidden: true, updatedAt: timestamp }]);
    else if (path === '/api/v1/admin/mentoring/summary') data = { pendingMentorCount: 1, activeProgramCount: 1, monthlySessionCount: 4, escrowHeldAmount: 50000 };
    else if (path === '/api/v1/admin/mentoring/mentors') data = paged([{ userId: targetId, name: '신청자', handle: 'target', bio: '멘토 소개', ratingAvg: null, reviewCount: 0, menteeCount: 0, status: 'PENDING_APPROVAL', appliedAt: timestamp }]);
    else if (path === '/api/v1/admin/mentoring/programs') data = paged([{ id: 'program-id', title: '멘토 프로그램', game: 'PUBG', mentorHandle: 'target', mentorNickname: '신청자', price: 10000, sessions: 3, rating: null, reports: 0, status: 'ACTIVE', isHidden: false, createdAt: timestamp }]);
    else if (path === '/api/v1/admin/settings') data = Object.entries({ AUTO_HIDE_ENABLED: 'true', AUTO_HIDE_THRESHOLD: '5', NEW_REPORT_ALERT: 'false', DEFAULT_SANCTION_LEVEL: 'SUSPENSION_3D', RE_REVIEW_DEADLINE_DAYS: '7' }).map(([configKey, configValue]) => ({ configKey, configValue, description: '', updatedAt: timestamp }));
    else { await route.fulfill({ status: 404, json: { success: false, message: '정의되지 않은 테스트 API: ' + path } }); return; }
    await route.fulfill({ json: { success: true, data } });
  });
  await page.route('**/api/v1/reports/reasons', (route) => route.fulfill({ json: { success: true, data: [{ code: 'SPAM', label: '스팸' }] } }));
  return bodies;
}

test('report detail integrates review, 3-day sanction and hiding then reflects revocation and audit', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-08T00:00:00Z'));
  await session(page);
  const bodies = await adminRoutes(page);
  await page.goto('/admin/reports');
  await page.getByRole('link', { name: 'RPT-INTEGRATION' }).click();
  await page.getByRole('button', { name: '검토 시작' }).click();
  const penalty = page.getByRole('combobox', { name: '사용자 제재' });
  await expect(penalty).toBeEnabled();
  await penalty.selectOption('SUSPENSION_3D');
  await page.getByLabel('게시글 숨기기', { exact: true }).check();
  await page.getByPlaceholder('처리 근거를 구체적으로 작성해주세요. 이 내용은 작업 이력에 기록됩니다.').fill('반복적인 광고');
  await page.getByRole('button', { name: '처리 내용 확인' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '숨김 처리 후 완료' }).click();
  await expect(page.getByText('처리 완료된 신고입니다.')).toBeVisible();
  const endTime = page.locator('time').filter({ hasText: '2026년 10월 11일 오전 9:00' });
  await expect(endTime).toHaveText('2026년 10월 11일 오전 9:00');
  await expect(endTime).toHaveAttribute('datetime', '2026-10-11T00:00:00.000Z');
  await expect(endTime).toHaveAttribute('title', '2026년 10월 11일 오전 9:00');
  expect(bodies).toEqual([{ decision: 'RESOLVED', hideTargetContent: true, penaltyType: 'SUSPENSION_3D', reason: '반복적인 광고', internalMemo: null }]);
  await page.goto('/admin/users/target');
  await expect(page.getByRole('heading', { name: '대상 사용자' })).toBeVisible();
  await expect(page.getByText('정지', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '선택한 제재 해제' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '제재 해제', exact: true }).click();
  await expect(page.getByText('활성', { exact: true })).toBeVisible();
  await page.goto('/admin/audit-logs');
  await expect(page.getByText('신고 판정 완료: 반복적인 광고')).toBeVisible();
});

test('an administrator target cannot receive even a warning', async ({ page }) => {
  await session(page);
  await adminRoutes(page, 'ADMIN');
  await page.goto('/admin/reports/RPT-INTEGRATION');
  await page.getByRole('button', { name: '검토 시작' }).click();
  await expect(page.getByText('관리자 및 본인 계정에는 경고를 포함한 제재를 부여할 수 없습니다.')).toBeVisible();
  await expect(page.getByRole('combobox', { name: '사용자 제재' })).toBeDisabled();
  await expect(page.getByText('관련 신고 함께 처리')).toHaveCount(0);
});

for (const screenMode of [
  { name: 'desktop-light', width: 1440, height: 900, dark: false },
  { name: 'desktop-dark', width: 1440, height: 900, dark: true },
  { name: 'mobile-light', width: 390, height: 844, dark: false },
  { name: 'mobile-dark', width: 390, height: 844, dark: true },
]) {
  test('my reports shows only reporter data with expandable details and no viewport overflow: ' + screenMode.name, async ({ page }) => {
    await session(page, 'USER');
    await page.setViewportSize({ width: screenMode.width, height: screenMode.height });
    await page.emulateMedia({ colorScheme: screenMode.dark ? 'dark' : 'light' });
    await page.route('**/api/v1/reports/my?*', (route) => route.fulfill({ json: { success: true, data: paged([{ ...reportBase, status: 'IN_REVIEW' }]) } }));
    await page.goto('/reports/my');
    await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), screenMode.dark);
    await expect(page.getByRole('cell', { name: 'RPT-INTEGRATION', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'RPT-INTEGRATION 내용 보기' }).click();
    await expect(page.getByText('반복적인 광고')).toBeVisible();
    await expect(page.getByText('신고 당시 게시물 요약')).toBeVisible();
    await expect(page.locator('a[href^="/admin/"]')).toHaveCount(0);
    await expect(page.locator('time').first()).toHaveAttribute('datetime', '2026-10-01T00:00:00.000Z');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
