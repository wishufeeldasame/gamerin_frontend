import { expect, test, type Page } from '@playwright/test';

const user = {
  userId: '11111111-1111-1111-1111-111111111111', handle: 'author',
  nickname: '작성자', role: 'ROLE_USER', status: 'ACTIVE',
};
const post = {
  postId: 'post-1', author: user.nickname, authorHandle: user.handle,
  authorProfileImageUrl: null, authorVerifiedBadge: false, content: '토스트 확인창 테스트',
  media: [], likes: 0, comments: 1, shares: 0, isReposted: false, repostCount: 0,
  likedByMe: false, bookmarkedByMe: false, mine: true, createdAt: '2026-10-01T00:00:00Z',
};
const comment = {
  commentId: 'comment-1', author: user.nickname, authorHandle: user.handle,
  authorProfileImageUrl: null, authorVerifiedBadge: false, content: '삭제할 테스트 댓글',
  mine: true, createdAt: post.createdAt,
};
async function mockApp(page: Page, options: { posts?: typeof post[]; distinctLikeErrors?: boolean } = {}) {
  let deletes = 0;
  await page.addInitScript((account) => {
    localStorage.setItem('gamerin_user', JSON.stringify({
      id: account.userId, handle: account.handle, nickname: account.nickname,
      name: account.nickname, gameTier: '', role: account.role, status: account.status,
    }));
  }, user);
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'PATCH' && path.endsWith('/users/me')) {
      await route.fulfill({ status: 500, json: { success: false, message: '프로필 저장 실패 테스트' } });
      return;
    }
    if (route.request().method() === 'DELETE' && path.includes('/posts/')) {
      deletes += 1;
      await route.fulfill({ status: 500, json: { success: false, message: '삭제 처리 실패: 다시 시도해 주세요.' } });
      return;
    }
    if (path.endsWith('/likes')) {
      const prefix = options.distinctLikeErrors ? `${path}: ` : '';
      await route.fulfill({ status: 500, json: { success: false, message: prefix + '좋아요 처리 실패: 다시 시도해 주세요. '.repeat(8) } });
      return;
    }
    let data: unknown = null;
    if (path.endsWith('/auth/refresh')) data = { accessToken: 'feedback-test-token' };
    else if (path.endsWith('/auth/me')) data = user;
    else if (path.endsWith('/users/me')) data = {
      id: user.userId, handle: user.handle, nickname: user.nickname,
      bio: null, location: null, website: null, coverImageUrl: null, profileImageUrl: null,
      gameStats: {}, verifiedBadge: false, followersCount: 0, followingCount: 0,
      postCount: 1, mediaPostCount: 0, mediaItemCount: 0,
    };
    else if (path.endsWith('/feed') || path.endsWith('/users/author/posts')) data = { items: options.posts ?? [post], hasNext: false, nextCursor: null };
    else if (path.endsWith('/users/author/media')) data = { items: [], hasNext: false, nextCursor: null };
    else if (path.endsWith('/posts/post-1/comments')) data = [comment];
    else if (path.endsWith('/posts/post-1')) data = post;
    else if (path.includes('/collections')) data = [];
    else if (path.includes('unread-count')) data = { unreadCount: 0 };
    await route.fulfill({ json: { success: true, data } });
  });
  return () => deletes;
}

test('카드 삭제: 초기 포커스·Tab 제한·Esc 취소·포커스 복귀와 확인 1회 요청', async ({ page }) => {
  const deletes = await mockApp(page);
  await page.goto('/home');
  const menu = page.getByRole('button', { name: '게시물 메뉴', exact: true });
  await menu.click();
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: '취소' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: '삭제' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: '취소' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(menu).toBeFocused();
  expect(deletes()).toBe(0);
  await menu.click();
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await dialog.getByRole('button', { name: '삭제' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '삭제 처리 실패' })).toBeVisible();
  expect(deletes()).toBe(1);
  await expect(page.getByText(post.content)).toBeVisible();
});

test('댓글 삭제: Esc 취소는 API를 호출하지 않고 댓글 메뉴로 복귀', async ({ page }) => {
  const deletes = await mockApp(page);
  await page.goto('/posts/post-1');
  await page.getByRole('button', { name: '댓글 메뉴' }).click();
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: '댓글 메뉴' })).toBeFocused();
  await expect(page.getByText(comment.content)).toBeVisible();
  expect(deletes()).toBe(0);
});

for (const dark of [false, true]) {
  test(`모바일 ${dark ? '다크' : '라이트'}: 프로필 저장 실패 토스트가 편집창 위에 표시되고 닫힌다`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockApp(page);
    if (dark) await page.addInitScript(() => localStorage.setItem('gamerin_theme', 'dark'));
    await page.goto('/profile/author');
    await page.getByRole('button', { name: 'Edit Profile', exact: true }).click();
    await page.getByRole('button', { name: 'SAVE', exact: true }).click();
    const toast = page.getByRole('alert').filter({ hasText: '프로필 저장 실패 테스트' });
    await expect(toast).toBeVisible();
    const close = toast.getByRole('button', { name: '알림 닫기' });
    expect(await close.evaluate((button) => {
      const bounds = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
    })).toBe(true);
    await close.click();
    await expect(toast).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Edit Profile' })).toBeVisible();
  });

  test(`모바일 ${dark ? '다크' : '라이트'}: 스택에서 가려진 긴 토스트는 표시된 후에만 만료된다`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockApp(page, {
      posts: [1, 2, 3].map((index) => ({ ...post, postId: `post-${index}` })),
      distinctLikeErrors: true,
    });
    if (dark) await page.addInitScript(() => localStorage.setItem('gamerin_theme', 'dark'));
    await page.goto('/home');
    const likes = page.locator('article button').filter({ has: page.locator('svg.lucide-heart') });
    await expect(likes).toHaveCount(3);
    // Concurrent mock responses reproduce the overflow without moving focus into the toast.
    await likes.evaluateAll((buttons) => buttons.forEach((button) => (button as HTMLButtonElement).click()));
    const toasts = page.getByRole('alert').filter({ hasText: '좋아요 처리 실패' });
    await expect(toasts).toHaveCount(3);
    const last = toasts.nth(2);
    const lastMessage = await last.textContent();
    const clipped = page.getByRole('alert').filter({ hasText: lastMessage! });
    expect(await clipped.evaluate((element) => {
      const item = element.getBoundingClientRect();
      const stack = element.parentElement!.getBoundingClientRect();
      return item.top >= stack.bottom;
    })).toBe(true);
    await page.waitForTimeout(6500);
    await expect(clipped).toBeAttached();
    await clipped.evaluate((element) => { element.parentElement!.scrollTop = element.parentElement!.scrollHeight; });
    await expect(clipped).toBeInViewport({ ratio: 1 });
    await page.waitForTimeout(6500);
    await expect(clipped).not.toBeAttached();
  });

  test(`모바일 ${dark ? '다크' : '라이트'}: 긴 토스트는 탭바 위에 표시되고 닫을 수 있다`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockApp(page);
    if (dark) await page.addInitScript(() => localStorage.setItem('gamerin_theme', 'dark'));
    await page.goto('/home');
    await page.locator('article button').filter({ has: page.locator('svg.lucide-heart') }).click();
    const toast = page.getByRole('alert').filter({ hasText: '좋아요 처리 실패' });
    await expect(toast).toBeVisible();
    const bounds = await toast.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(16);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(359);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(812 - 64 - 16);
    const contrast = await toast.evaluate((element) => {
      const style = getComputedStyle(element);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d')!;
      const luminance = (color: string) => {
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        const channels = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3).map((channel) => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const foreground = luminance(style.color);
      const background = luminance(style.backgroundColor);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    await page.getByRole('button', { name: '알림 닫기' }).click();
    await expect(toast).not.toBeVisible();
    await page.getByRole('button', { name: '게시물 메뉴', exact: true }).click();
    await page.getByRole('button', { name: '삭제', exact: true }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    const dialogBounds = await dialog.boundingBox();
    expect(dialogBounds!.x).toBeGreaterThanOrEqual(16);
    expect(dialogBounds!.x + dialogBounds!.width).toBeLessThanOrEqual(359);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
}
