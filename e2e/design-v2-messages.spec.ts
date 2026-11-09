import { expect, test } from '@playwright/test';
import { installAuditFixture } from './support/fe8-audit';

for (const theme of ['light', 'dark'] as const) {
  for (const width of [390, 768, 1024, 1440]) {
    test(`메시지 v2 ${theme} ${width}px 목록·대화·뒤로 이동`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await installAuditFixture(page, theme);
      await page.goto('/messages');

      const list = page.getByRole('region', { name: '대화 목록' });
      const chat = page.getByRole('region', { name: '메시지 대화' });
      const topBar = page.locator('[data-mobile-top-bar]');
      const tabBar = page.locator('[data-mobile-tab-bar]');
      await expect(list).toBeVisible();
      await list.getByRole('button', { name: /대화상대/ }).click();
      await expect(chat.getByText('받은 메시지', { exact: true })).toBeVisible();
      await expect(chat.getByText('보낸 메시지', { exact: true })).toBeVisible();
      const sentBubble = chat.getByText('보낸 메시지', { exact: true }).locator('..');
      await expect(sentBubble).toHaveCSS('background-color', 'rgb(245, 185, 61)');
      await expect(sentBubble).toHaveCSS('color', 'rgb(26, 20, 6)');
      await expect(chat.getByRole('button', { name: '메시지 전송' })).toBeDisabled();
      await chat.getByPlaceholder('메시지 입력').fill('메시지 작성');
      await expect(chat.getByRole('button', { name: '메시지 전송' })).toBeEnabled();
      await page.screenshot({ path: testInfo.outputPath('messages-chat.png') });

      if (width < 768) {
        await expect(list).toBeHidden();
        await expect(topBar).toBeHidden();
        await expect(tabBar).toBeHidden();
        const header = await chat.getByRole('button', { name: '대화 목록으로 돌아가기' }).boundingBox();
        expect(header!.y).toBeLessThan(20);
        const send = await chat.getByRole('button', { name: '메시지 전송' }).boundingBox();
        expect(send!.y + send!.height).toBeLessThanOrEqual(900);
        await chat.getByRole('button', { name: '대화 목록으로 돌아가기' }).click();
        await expect(list).toBeVisible();
        await expect(chat).toBeHidden();
        await expect(topBar).toBeVisible();
        await expect(tabBar).toBeVisible();
        await expect(page.locator('body')).not.toHaveAttribute('data-chat-open');
      } else {
        await expect(list).toBeVisible();
        await expect(chat.getByRole('button', { name: '대화 목록으로 돌아가기' })).toBeHidden();
      }

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}

test('메시지 검색 결과 없음과 긴 메시지 줄바꿈', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await installAuditFixture(page, 'dark');
  const longMessage = '긴메시지'.repeat(100);
  await page.route('**/api/v1/messages/conversations/conversation-1/messages**', route => route.fulfill({
    json: { success: true, data: {
      items: [{ id: 'long-message', senderId: 'recipient', text: longMessage, createdAt: '2026-11-08T06:00:00Z', read: true, deliveryStatus: 'sent', attachments: [], sharedPost: null }],
      nextCursor: null, hasNext: false,
    } },
  }));
  await page.goto('/messages');
  const search = page.getByRole('textbox', { name: '대화 또는 사용자 검색' });
  await search.fill('없는사용자');
  await expect(page.getByText('검색 결과가 없습니다.', { exact: true })).toBeVisible();
  await search.fill('');
  await page.getByRole('button', { name: /대화상대/ }).click();
  const message = page.getByText(longMessage, { exact: true });
  await expect(message).toBeVisible();
  expect(await message.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '대화 목록으로 돌아가기' }).click();
  await page.getByRole('link', { name: '홈', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('body')).not.toHaveAttribute('data-chat-open');
  await expect(page.locator('[data-mobile-top-bar]')).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) {
  test(`모바일 키보드 표시 영역과 복원 ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await installAuditFixture(page, theme);
    await page.goto('/messages');
    await page.getByRole('button', { name: /대화상대/ }).click();
    await page.addStyleTag({ content: '[data-message-composer] { padding-bottom: 46px; }' });
    await page.getByPlaceholder('메시지 입력').focus();
    const shell = page.locator('[data-message-shell]');
    const composer = page.locator('[data-message-composer]');
    for (const [height, top] of [[470, 60], [430, 100], [900, 0]]) {
      await page.evaluate(({ height, top }) => {
        Object.defineProperties(window.visualViewport!, {
          height: { configurable: true, value: height },
          offsetTop: { configurable: true, value: top },
        });
        window.visualViewport!.dispatchEvent(new Event('resize'));
        window.visualViewport!.dispatchEvent(new Event('scroll'));
      }, { height, top });
      await expect(shell).toHaveCSS('height', `${height}px`);
      await expect(composer).toHaveCSS('padding-bottom', height < 900 ? '12px' : '46px');
      const box = (await shell.boundingBox())!;
      const input = (await composer.boundingBox())!;
      expect(box.y).toBe(top);
      expect(Math.round(input.y + input.height)).toBe(height + top);
      expect(await composer.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
    await page.getByRole('button', { name: '대화 목록으로 돌아가기' }).click();
    await expect(shell).toHaveCSS('position', 'static');
    await expect(page.locator('body')).toHaveCSS('overflow', 'visible');
    await expect(page.locator('body')).not.toHaveAttribute('data-chat-open');
  });
}

for (const standalone of [false, true]) {
  for (const [width, height] of [[400, 1400], [1600, 300]]) {
    test(`첨부 확대 ${width}x${height} ${standalone ? '설치 앱 안전 영역' : '브라우저'}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await installAuditFixture(page, 'dark', { attachments: true });
      await page.route('**/api/v1/messages/attachments/review-image', route => route.fulfill({
        contentType: 'image/svg+xml',
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#333"/></svg>`,
      }));
      await page.goto('/messages');
      await page.getByRole('button', { name: /대화상대/ }).click();
      await page.getByRole('button', { name: '받은 이미지.png 확대 보기' }).click();
      if (standalone) {
        await page.addStyleTag({ content: '.dm-image-lightbox { padding-top: 59px; padding-bottom: 34px; }' });
      }
      const dialog = page.getByRole('dialog', { name: '받은 이미지.png', exact: true });
      await expect(dialog).toBeVisible();
      for (const locator of [dialog.getByRole('img'), dialog.getByRole('button', { name: '이미지 닫기' }), dialog.getByText('받은 이미지.png')]) {
        const box = (await locator.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(standalone ? 59 : 16);
        expect(box.x + box.width).toBeLessThanOrEqual(390);
        expect(box.y + box.height).toBeLessThanOrEqual(844 - (standalone ? 34 : 16));
      }
      await page.evaluate(() => {
        Object.defineProperties(window.visualViewport!, {
          height: { configurable: true, value: 500 },
          offsetTop: { configurable: true, value: 60 },
        });
        window.visualViewport!.dispatchEvent(new Event('resize'));
      });
      await expect(dialog).toHaveCSS('height', '500px');
      const close = (await dialog.getByRole('button', { name: '이미지 닫기' }).boundingBox())!;
      expect(close.y).toBeGreaterThanOrEqual(60 + (standalone ? 59 : 16));
      expect(close.y + close.height).toBeLessThanOrEqual(560);
      await dialog.getByRole('button', { name: '이미지 닫기' }).click();
      await expect(dialog).toHaveCount(0);
    });
  }
}
