import { expect, test } from '@playwright/test';
import { installAuditFixture } from './support/fe8-audit';

for (const theme of ['light', 'dark'] as const) {
  for (const width of [320, 1440]) {
    test(`공통 Noto Sans KR ${theme} ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await installAuditFixture(page, theme, { anonymous: true });
      for (const path of ['/', '/signup', '/admin/login']) {
        await page.goto(path);
        await expect(page.getByRole('heading').first()).toBeVisible();
        const fonts = await page.evaluate(async () => {
          await document.fonts.ready;
          const family = getComputedStyle(document.body).fontFamily.split(',')[0].trim();
          const heading = document.querySelector('h1, h2')!;
          return {
            family,
            headingFamily: getComputedStyle(heading).fontFamily.split(',')[0].trim(),
            variable: getComputedStyle(document.documentElement).getPropertyValue('--font-noto-sans-kr'),
            loaded: [...document.fonts].some(font => font.family === family.replaceAll('"', '') && font.status === 'loaded'),
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        expect(fonts.variable).toContain(fonts.family.replaceAll('"', ''));
        expect(fonts.headingFamily).toBe(fonts.family);
        expect(fonts.loaded).toBe(true);
        expect(fonts.overflow).toBe(false);
      }
    });
  }
}
