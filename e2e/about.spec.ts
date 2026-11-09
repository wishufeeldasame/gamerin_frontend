import { expect, test, type Page } from '@playwright/test';

async function installDemoFixture(page: Page, theme: 'dark' | 'light', savedSession = false) {
  const calls: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(({ theme, savedSession }) => {
    localStorage.setItem('gamerin_user_settings', JSON.stringify({ theme }));
    if (savedSession) localStorage.setItem('gamerin_user', JSON.stringify({ id: 'demo-test', handle: 'demo-test', nickname: '테스트 사용자', role: 'USER', status: 'ACTIVE' }));
  }, { theme, savedSession });
  await page.route('**/api/v1/**', (route) => {
    calls.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
    return route.fulfill({ status: 503, json: { success: false, message: '테스트용 일시 장애' } });
  });
  return { calls, errors };
}

for (const theme of ['dark', 'light'] as const) {
  for (const width of [1440, 768, 390, 320]) {
    test(`데모 공개 접근·정적 결과·레이아웃 ${theme} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const { calls, errors } = await installDemoFixture(page, theme);
      await page.goto('/about');
      await expect(page.getByRole('heading', { level: 1 })).toContainText('연결은 계속되니까.');
      await expect(page.locator('.ss-stage')).toHaveCount(4);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /일시정지|다시 보기/ })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'GamerIN 시작하기', exact: true }).first()).toHaveAttribute('href', '/');
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);

      const payoffs = ['.profile-updated', '.collection-result', '.mentoring-application-note', '.ss-receipt'];
      for (const selector of payoffs) {
        const payoff = page.locator(selector);
        await payoff.scrollIntoViewIfNeeded();
        await expect(payoff).toBeVisible();
        expect(await payoff.evaluate((node) => {
          const r = node.getBoundingClientRect();
          const stage = node.closest('.ss-stage')!.getBoundingClientRect();
          return r.left >= stage.left - 1 && r.right <= stage.right + 1 && r.top >= stage.top - 1 && r.bottom <= stage.bottom + 1;
        }), `${selector} 결과가 잘리지 않아야 함`).toBe(true);
      }
      const feed = page.locator('#demo-feed');
      expect(await feed.evaluate((node) => {
        const art = node.querySelector('.feed-game-art')!.getBoundingClientRect();
        const result = node.querySelector('.collection-result')!.getBoundingClientRect();
        return art.bottom < result.top;
      })).toBe(true);
      await expect(feed.locator('.feed-collection')).toHaveCSS('opacity', '0');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(calls).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

for (const width of [1440, 390]) {
  test(`동작 재생·일시정지·재개·다시 보기 ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 900 });
    const { calls, errors } = await installDemoFixture(page, 'dark');
    await page.goto('/about');
    await expect(page.locator('.ss-stage')).toHaveCount(4);
    for (const [name, selector, text] of [
      ['profile', '.profile-updated', '방금 업데이트됨'],
      ['feed', '.collection-result', '컬렉션에 저장했어요'],
      ['mentoring', '.mentoring-application-note', '멘토의 수락을 기다리고 있어요.'],
    ]) {
      await page.locator(`#demo-${name}`).scrollIntoViewIfNeeded();
      await expect(page.locator(selector)).toContainText(text, { timeout: 15000 });
    }
    const scene = page.locator('#demo-messages');
    await scene.scrollIntoViewIfNeeded();
    const draft = scene.locator('.ss-field__chars');
    await expect(draft).toContainText('저는', { timeout: 10000 });
    await scene.getByRole('button', { name: '다이렉트 메시지 일시정지' }).click();
    const stopped = await draft.textContent();
    await page.waitForTimeout(600);
    expect(await draft.textContent()).toBe(stopped);
    expect(await scene.locator('.ss-stage').evaluate((node) => node.getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running').length)).toBe(0);
    await scene.getByRole('button', { name: '다이렉트 메시지 재생', exact: true }).click();
    await expect(scene.locator('.ss-stage')).toHaveAttribute('data-mark', 'sent', { timeout: 10000 });
    await expect(scene.locator('.ss-receipt')).not.toHaveAttribute('data-show');
    await expect(scene.locator('.ss-receipt')).toContainText('읽음', { timeout: 15000 });
    await expect(scene.locator('.ss-bubble-row')).toHaveCount(2);
    await page.locator('#demo-profile').scrollIntoViewIfNeeded();
    await scene.scrollIntoViewIfNeeded();
    await expect(scene.locator('.ss-bubble-row')).toHaveCount(2);
    await scene.getByRole('button', { name: '다이렉트 메시지 다시 보기' }).click();
    await expect(scene.locator('.ss-bubble-row')).toHaveCount(1);
    await expect(scene.locator('.ss-field__chars')).toHaveText('');
    expect(calls).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test.describe('세션 복원 장애 fixture', () => {
  // 프로덕션 로컬 3000의 8080 API 요청도 실제 통신 대신 아래 503 mock으로 검증한다.
  test.use({ bypassCSP: true });
  test('기존 세션 복원 장애가 데모를 가리지 않으며 실제 쓰기를 하지 않는다', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { calls, errors } = await installDemoFixture(page, 'dark', true);
    await page.goto('/about');
    await expect(page.locator('.profile-updated')).toContainText('방금 업데이트됨');
    await expect.poll(() => calls.length).toBeGreaterThan(0);
    expect(calls.every((call) => call === 'POST /api/v1/auth/refresh')).toBe(true);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test('장면 내부는 탭 순서에서 제외하고 재생 제어는 키보드로 작동한다', async ({ page }) => {
  await installDemoFixture(page, 'dark');
  await page.goto('/about');
  const pause = page.getByRole('button', { name: '전적 프로필 일시정지' });
  await pause.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: '전적 프로필 재생', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '전적 프로필 다시 보기' })).toBeFocused();
  expect(await page.locator('.demo-player-picture').evaluateAll((nodes) => nodes.every((node) => node.hasAttribute('inert') && node.getAttribute('aria-hidden') === 'true'))).toBe(true);
});

test('재생 중 모션 설정 변경과 화면 크기 변경 뒤에도 결과와 타깃을 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { errors } = await installDemoFixture(page, 'dark');
  await page.goto('/about');
  await expect(page.locator('.profile-updated')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.profile-updated')).toContainText('방금 업데이트됨');
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.locator('#demo-profile .ss-stage')).toHaveAttribute('data-layout', 'compact');
  await expect(page.locator('.profile-updated')).toContainText('방금 업데이트됨');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('.profile-updated')).toContainText('방금 업데이트됨', { timeout: 12000 });
  expect(errors).toEqual([]);
});
