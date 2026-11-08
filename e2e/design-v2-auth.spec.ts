import { expect, test } from '@playwright/test';
import { controlContrast, installAuditFixture } from './support/fe8-audit';

for (const theme of ['light', 'dark'] as const) {
  for (const width of [320, 390, 768, 1024, 1440]) {
    test(`계정 화면 v2 ${theme} ${width}px 입력·상태·가입`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await installAuditFixture(page, theme, { anonymous: true });

      for (const [path, title] of [
        ['/find-id', '아이디 찾기'],
        ['/find-id-result?maskedHandle=vi***&createdAt=2026-10-01', '아이디를 찾았습니다'],
        ['/auth/forgot-password', '비밀번호 찾기'],
        ['/auth/reset-password', '유효하지 않은 링크입니다'],
        ['/auth/reset-password?token=fixture', '비밀번호 재설정'],
        ['/auth/social/complete#signupToken=fixture', '추가 정보 입력'],
        ['/signup', '회원가입'],
      ]) {
        await page.goto(path);
        await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        for (const input of await page.locator('input:not([type="checkbox"])').all()) {
          await expect(input).toHaveAccessibleName(/.+/);
          expect((await input.boundingBox())!.height).toBe(48);
          expect((await controlContrast(input)).ratio).toBeGreaterThanOrEqual(4.5);
        }
      }

      await expect(page.getByLabel('닉네임', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: '다음', exact: true })).toBeDisabled();
      await page.getByLabel('필수 항목 전체 동의').check();
      await page.getByRole('button', { name: '다음', exact: true }).click();
      await page.getByLabel('닉네임', { exact: true }).fill('테스터');
      await page.getByLabel('이메일', { exact: true }).fill('viewer@example.com');
      await page.getByRole('button', { name: '인증번호 받기' }).click();
      await page.getByLabel('인증번호', { exact: true }).fill('123456');
      await page.getByRole('button', { name: '확인', exact: true }).click();
      await expect(page.getByText('이메일 인증이 완료되었습니다.')).toBeVisible();
      await page.getByLabel('아이디', { exact: true }).fill('viewer');
      await page.getByLabel('비밀번호', { exact: true }).fill('Password1!');
      await page.getByLabel('비밀번호 확인', { exact: true }).fill('different');
      await expect(page.getByLabel('비밀번호 확인', { exact: true })).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByRole('button', { name: '가입 완료' })).toBeDisabled();
      await page.getByLabel('비밀번호 확인', { exact: true }).fill('Password1!');
      await page.getByRole('button', { name: '이전', exact: true }).click();
      await expect(page.getByLabel('필수 항목 전체 동의')).toBeChecked();
      await page.getByRole('button', { name: '다음', exact: true }).click();
      await expect(page.getByLabel('닉네임', { exact: true })).toHaveValue('테스터');
      await expect(page.getByLabel('비밀번호', { exact: true })).toHaveValue('Password1!');
      await expect(page.getByText('이메일 인증이 완료되었습니다.')).toBeVisible();
      const submit = page.getByRole('button', { name: '가입 완료' });
      await expect(submit).toBeEnabled();
      await expect(submit).toHaveCSS('background-color', 'rgb(245, 185, 61)');
      expect((await controlContrast(submit)).ratio).toBeGreaterThanOrEqual(4.5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 320 || width === 1440) {
        await page.screenshot({ path: testInfo.outputPath('signup.png'), fullPage: true });
      }

      await page.goto('/auth/reset-password?token=fixture');
      await page.getByLabel('새 비밀번호', { exact: true }).fill('Password1!');
      await page.getByRole('button', { name: '비밀번호 표시', exact: true }).click();
      await expect(page.getByLabel('새 비밀번호', { exact: true })).toHaveAttribute('type', 'text');
      await page.getByRole('button', { name: '비밀번호 숨기기', exact: true }).click();
      await expect(page.getByLabel('새 비밀번호', { exact: true })).toHaveAttribute('type', 'password');

      await page.goto('/auth/forgot-password');
      await page.route('**/api/v1/auth/find-password', route => route.fulfill({ json: { success: true, data: null } }));
      await page.getByLabel('아이디', { exact: true }).fill('viewer');
      await page.getByRole('button', { name: '비밀번호 재설정 메일 받기' }).click();
      await expect(page.getByRole('heading', { name: '메일을 확인해 주세요' })).toBeVisible();
      await expect(page.getByRole('button', { name: '로그인하러 가기' })).toBeVisible();
    });
  }
}
