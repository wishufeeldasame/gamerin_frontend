import { expect, test } from '@playwright/test';
import { installAuditFixture } from './support/fe8-audit';

for (const theme of ['light', 'dark'] as const) {
  for (const width of [320, 390, 768, 1024, 1440]) {
    test(`계정 설정 v2 ${theme} ${width}px 카드·탭·입력`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1024 });
      await installAuditFixture(page, theme, { linkedStats: true });
      await page.goto('/settings');

      const menu = page.getByRole('navigation', { name: '설정 메뉴' });
      const account = page.getByRole('region', { name: '계정 정보' });
      const password = page.getByRole('region', { name: '비밀번호 변경' });
      const danger = page.getByRole('region', { name: '위험 영역' });
      await expect(account.getByLabel('아이디')).toHaveValue('@viewer');
      await expect(account.getByLabel('아이디')).toHaveAttribute('readonly');
      await expect(account.getByRole('link', { name: '내 신고' })).toHaveAttribute('href', '/reports/my');
      await expect(menu.getByRole('button', { name: '계정', exact: true })).toHaveAttribute('aria-current', 'page');
      await expect(danger.getByRole('button', { name: '계정 삭제' })).toBeEnabled();
      await expect(page.getByRole('region', { name: '대표 게임', exact: true })).toHaveCount(0);

      const accountBox = (await account.boundingBox())!;
      const passwordBox = (await password.boundingBox())!;
      const buttonBox = (await password.getByRole('button', { name: '비밀번호 변경' }).boundingBox())!;
      expect(accountBox.width).toBeLessThanOrEqual(640);
      expect(passwordBox.y - accountBox.y - accountBox.height).toBe(width >= 1024 ? 16 : 12);
      expect(Math.round(passwordBox.x + passwordBox.width - buttonBox.x - buttonBox.width)).toBe(24);
      const accountTab = (await menu.getByRole('button', { name: '계정', exact: true }).boundingBox())!;
      const personalizationTab = (await menu.getByRole('button', { name: '개인화', exact: true }).boundingBox())!;
      expect(accountTab.y).toBe(personalizationTab.y);
      expect(accountTab.y).toBeLessThan(accountBox.y);
      if (width >= 1024) expect(accountBox.width).toBe(640);
      await page.screenshot({ path: testInfo.outputPath('settings-account.png'), fullPage: true });

      await page.getByLabel('현재 비밀번호', { exact: true }).fill('OldPassword1!');
      await menu.getByRole('button', { name: '개인화', exact: true }).click();
      await expect(account).toBeHidden();
      await expect(page.getByRole('button', { name: /다크 모드/ })).toBeVisible();
      const games = page.getByRole('region', { name: '대표 게임', exact: true });
      await expect(games).toBeVisible();
      const none = games.getByRole('radio', { name: '표시 안 함', exact: true });
      const pubg = games.getByRole('radio', { name: 'PUBG', exact: true });
      await expect(none).toBeChecked();
      await expect(pubg).toBeEnabled();
      await expect(games.getByRole('radio', { name: '발로란트 (연동 필요)', exact: true })).toBeDisabled();
      await page.keyboard.press('Tab');
      await none.focus();
      await expect(none).toBeFocused();
      await expect(none.locator('+ span')).toHaveCSS('outline-style', 'solid');
      await expect(none.locator('+ span')).toHaveCSS('border-color', 'rgb(245, 185, 61)');
      await page.screenshot({ path: testInfo.outputPath('settings-personalization.png'), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await menu.getByRole('button', { name: '계정', exact: true }).click();
      await expect(page.getByLabel('현재 비밀번호', { exact: true })).toHaveValue('OldPassword1!');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}

test('대표 게임은 키보드로 선택하고 저장 결과를 표시한다', async ({ page }) => {
  await installAuditFixture(page, 'dark', { linkedStats: true });
  let selected: string | null = null;
  await page.route('**/api/v1/users/me/representative-game', async route => {
    selected = route.request().postDataJSON().game;
    await route.fulfill({ json: { success: true, data: null } });
  });
  await page.route('**/api/v1/auth/me', route => route.fulfill({
    json: { success: true, data: { userId: 'viewer', handle: 'viewer', nickname: '테스터', role: 'USER', status: 'ACTIVE', representativeGame: selected } },
  }));
  await page.goto('/settings');
  await page.getByRole('button', { name: '개인화', exact: true }).click();
  const games = page.getByRole('region', { name: '대표 게임', exact: true });
  const none = games.getByRole('radio', { name: '표시 안 함', exact: true });
  const pubg = games.getByRole('radio', { name: 'PUBG', exact: true });
  await expect(pubg).toBeEnabled();
  await none.focus();
  await page.keyboard.press('ArrowRight');
  await expect(pubg).toBeChecked();
  expect(selected).toBe('PUBG');
  await expect(none).not.toBeChecked();
});
