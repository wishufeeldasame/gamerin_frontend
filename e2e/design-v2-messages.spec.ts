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
