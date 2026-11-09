import { expect, test } from '@playwright/test';
import { auditPost, installAuditFixture } from './support/fe8-audit';

const image = { name: 'upload.png', mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') };
const queued = { status: 'QUEUED', errorCode: null, errorMessage: null, post: null, message: null };

for (const [theme, width] of [['light', 390], ['dark', 1440]] as const) {
  test(`비동기 게시물 완료·DM 복귀·거부 ${theme} ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await installAuditFixture(page, theme);
    let postComplete = false;
    let messageRejected = false;
    const postRequests: string[] = [];
    const messageRequests: string[] = [];
    await page.route('**/api/v1/posts', async route => {
      postRequests.push(route.request().postData() ?? '');
      await route.fulfill({ status: 202, json: { success: true, data: { ...queued, jobId: 'post-job' } } });
    });
    await page.route('**/api/v1/posts/upload-jobs/**', route => route.fulfill({ json: { success: true,
      data: postComplete ? { ...queued, jobId: 'post-job', status: 'COMPLETED',
        post: { ...auditPost, postId: 'async-post', postNumber: 99, content: '비동기 처리 완료 게시물' } }
        : { ...queued, jobId: 'post-job' } } }));
    await page.route('**/api/v1/messages/conversations/conversation-1/messages**', async route => {
      if (route.request().method() !== 'POST') return route.fallback();
      messageRequests.push(route.request().postData() ?? '');
      await route.fulfill({ status: 202, json: { success: true, data: { ...queued, jobId: 'message-job' } } });
    });
    await page.route('**/api/v1/messages/upload-jobs/**', route => route.fulfill({ json: { success: true,
      data: messageRejected ? { ...queued, jobId: 'message-job', status: 'FAILED', errorCode: 'MODERATION_REJECTED',
        errorMessage: '콘텐츠 검열 정책에 따라 업로드가 거부됐습니다.' } : { ...queued, jobId: 'message-job' } } }));

    await page.goto('/');
    await page.getByRole('textbox', { name: '게시글 내용' }).fill('영속 저장하지 않을 게시물 본문');
    await page.locator('input[type=file][multiple]').first().setInputFiles(image);
    await expect(page.getByAltText('선택한 이미지 1')).toBeVisible();
    await page.getByRole('button', { name: '게시', exact: true }).click();
    await expect(page.getByText(/서버 접수 완료/)).toBeVisible();
    expect(postRequests).toHaveLength(1);
    expect(postRequests[0]).toContain('name="asyncUpload"');
    expect(postRequests[0]).toContain('name="clientRequestId"');
    await page.screenshot({ path: testInfo.outputPath('post-queued.png') });
    postComplete = true;
    await expect(page.getByText('비동기 처리 완료 게시물', { exact: true })).toBeVisible({ timeout: 8000 });
    expect(postRequests).toHaveLength(1);

    await page.goto('/messages?conversationId=conversation-1');
    await page.getByPlaceholder('메시지 입력').fill('영속 저장하지 않을 DM 본문');
    await page.locator('input[type=file][multiple]').setInputFiles(image);
    await page.getByRole('button', { name: '메시지 전송' }).click();
    await expect(page.getByText(/서버 접수 완료/)).toBeVisible();
    expect(messageRequests[0]).toContain('name="asyncUpload"');
    expect(messageRequests[0]).toContain('name="clientMessageId"');
    const saved = await page.evaluate(() => localStorage.getItem('gamerin_upload_jobs'));
    expect(saved).not.toContain('영속 저장하지 않을');
    expect(saved).not.toContain('upload.png');
    await page.reload();
    await expect(page.getByText('첨부 업로드 상태')).toBeVisible();
    messageRejected = true;
    await expect(page.getByText(/검열 거부 · 콘텐츠 검열 정책/)).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: '재시도', exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('message-rejected.png') });
    expect(messageRequests).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const dismiss = page.getByRole('button', { name: '삭제', exact: true });
    await dismiss.focus();
    await expect(dismiss).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByText('첨부 업로드 상태')).toHaveCount(0);
  });
}
