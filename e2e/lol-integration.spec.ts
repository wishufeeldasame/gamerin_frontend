import { expect, test, type Page } from '@playwright/test';
import { installAuditFixture } from './support/fe8-audit';

async function installLolFixture(page: Page, theme: 'light' | 'dark', failFirstSummary = false) {
  await installAuditFixture(page, theme);
  const pubg = { game: 'PUBG', connected: true, playerName: 'PubgPlayer', tierLabel: 'SILVER', kd: 2, winRate: 50, matches: 10, statsMode: 'RANKED' };
  let gameStats: Record<string, unknown> = { PUBG: pubg };
  let summaryCalls = 0;
  let connectCalls = 0;
  let disconnectCalls = 0;
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let data: unknown;
    if (path === '/api/v1/users/me' || path === '/api/v1/users/viewer') {
      data = { id: 'viewer', handle: 'viewer', nickname: '테스터', bio: null, location: null, website: null,
        coverImageUrl: null, profileImageUrl: null, gameStats, verifiedBadge: false, followersCount: 0, followingCount: 0, postCount: 0, mediaPostCount: 0, mediaItemCount: 0 };
    } else if (path === '/api/v1/riot/connect') {
      expect(request.method()).toBe('POST');
      expect(request.postDataJSON()).toEqual({ riotId: '소환사#KR1' });
      connectCalls++;
      gameStats.RIOT = { connected: true, riotId: '소환사#KR1', puuid: 'internal-account-identifier' };
      data = { connected: true, riotId: '소환사#KR1' };
    } else if (path === '/api/v1/riot/lol/me') {
      expect(request.method()).toBe('GET');
      summaryCalls++;
      if (failFirstSummary && summaryCalls === 1) {
        await route.fulfill({ status: 503, json: { success: false, message: 'Riot API Key가 설정되지 않았습니다.' } });
        return;
      }
      data = { gameName: 'League of Legends', connected: true, tierLabel: summaryCalls === 1 ? 'GOLD I' : 'PLATINUM IV', kda: 3.25, winRate: 60, games: 20 };
      gameStats.LOL = data;
    } else if (path === '/api/v1/riot/disconnect') {
      expect(request.method()).toBe('DELETE');
      disconnectCalls++;
      gameStats = { PUBG: pubg };
      data = null;
    } else if (path === '/api/v1/pubg/me') {
      data = pubg;
    } else {
      await route.fallback();
      return;
    }
    await route.fulfill({ json: { success: true, data } });
  });
  return { connects: () => connectCalls, summaries: () => summaryCalls, disconnects: () => disconnectCalls };
}

async function openLolPrompt(page: Page) {
  await page.goto('/profile/viewer');
  await page.getByRole('button', { name: '전적', exact: true }).click();
  await page.getByRole('button', { name: '전적 추가' }).click();
  await page.locator('div.group').filter({ has: page.getByRole('heading', { name: 'League of Legends', exact: true }) }).getByRole('button', { name: '연결', exact: true }).click();
}

for (const mode of [
  { width: 1440, height: 900, theme: 'light' as const },
  { width: 1440, height: 900, theme: 'dark' as const },
  { width: 390, height: 844, theme: 'light' as const },
  { width: 390, height: 844, theme: 'dark' as const },
]) {
  test(`LoL 연결, 새로고침, 해제 ${mode.width} ${mode.theme}`, async ({ page }) => {
    await page.setViewportSize(mode);
    const calls = await installLolFixture(page, mode.theme);
    await openLolPrompt(page);
    await page.getByRole('textbox', { name: 'Riot ID' }).fill('태그없음');
    await page.getByRole('button', { name: '연결', exact: true }).last().click();
    await expect(page.getByText('Riot ID를 닉네임#태그 형식으로 입력해 주세요. (예: 소환사#KR1)', { exact: true })).toBeVisible();
    expect(calls.connects()).toBe(0);
    await page.getByRole('textbox', { name: 'Riot ID' }).fill('소환사#KR1');
    await page.getByRole('button', { name: '연결', exact: true }).last().click();
    await expect(page.getByText('GOLD I · KDA 3.25 · 승률 60% · 20게임', { exact: true })).toBeVisible();
    await expect(page.getByText('internal-account-identifier')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: '연결된 게임 전적 새로고침' }).click();
    await expect(page.getByText('PLATINUM IV · KDA 3.25 · 승률 60% · 20게임', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'League of Legends 전적 연동 해제' }).click();
    await page.getByRole('button', { name: '연동 해제', exact: true }).click();
    await expect(page.getByRole('button', { name: 'League of Legends 전적 연동 해제' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'PUBG 전적 연동 해제' })).toBeVisible();
    expect(calls.connects()).toBe(1);
    expect(calls.summaries()).toBe(2);
    expect(calls.disconnects()).toBe(1);
  });
}

test('Riot 계정 연결 후 요약 조회 실패는 연결을 유지하고 새로고침으로 복구한다', async ({ page }) => {
  const calls = await installLolFixture(page, 'light', true);
  await openLolPrompt(page);
  await page.getByRole('textbox', { name: 'Riot ID' }).fill('소환사#KR1');
  await page.getByRole('button', { name: '연결', exact: true }).last().click();
  await expect(page.getByText('계정 연결됨 · 전적 새로고침으로 불러와 주세요.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'League of Legends 전적 연동 해제' })).toBeVisible();
  await expect(page.getByText('internal-account-identifier')).toHaveCount(0);
  await page.getByRole('button', { name: '연결된 게임 전적 새로고침' }).click();
  await expect(page.getByText('PLATINUM IV · KDA 3.25 · 승률 60% · 20게임', { exact: true })).toBeVisible();
  expect(calls.connects()).toBe(1);
});
