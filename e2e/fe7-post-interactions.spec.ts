import { expect, test, type Page } from '@playwright/test';

for (const path of ['/home', '/posts/post-1']) {
  test(`late share preserves newer likes on ${path}`, async ({ page }) => {
    await mockApp(page, 'light');
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    let started = false;
    await page.route('**/api/v1/posts/post-1/shares', async (route) => {
      started = true;
      await pending;
      await route.fulfill({ json: { success: true, data: { postId: 'post-1', shares: 1 } } });
    });
    await page.goto(path);
    await page.getByRole('button', { name: '게시물 공유' }).first().click();
    await page.getByRole('button', { name: '링크 복사' }).click();
    await expect.poll(() => started).toBe(true);
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await page.getByRole('button', { name: '좋아요 2개', exact: true }).first().click();
    await expect(page.getByRole('button', { name: '좋아요 3개', exact: true }).first()).toHaveAttribute('aria-pressed', 'true');
    const response = page.waitForResponse('**/api/v1/posts/post-1/shares');
    release();
    await response;
    // Wait beyond the modal's copy feedback timer so a late response has settled.
    await page.waitForTimeout(1500);
    await expect(page.getByRole('button', { name: '좋아요 3개', exact: true }).first()).toHaveAttribute('aria-pressed', 'true');
  });
}

for (const leave of [false, true]) {
  test(`delete navigates once and ignores an abandoned screen: ${leave}`, async ({ page }) => {
    await mockApp(page, 'light');
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    let started = false;
    await page.route('**/api/v1/posts/post-1', async (route) => {
      if (route.request().method() === 'DELETE') {
        started = true;
        await pending;
        await route.fulfill({ json: { success: true, data: null } });
      } else await route.fulfill({ json: { success: true, data: { ...post, mine: true, authorHandle: 'viewer' } } });
    });
    await page.goto('/home');
    await page.goto('/posts/post-1');
    await page.getByRole('button', { name: '게시물 메뉴', exact: true }).click();
    await page.getByRole('button', { name: '삭제', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: '삭제', exact: true }).click();
    await expect.poll(() => started).toBe(true);
    if (leave) {
      await page.getByRole('link', { name: '북마크', exact: true }).first().click();
      await expect(page).toHaveURL(/\/bookmarks$/);
    }
    const response = page.waitForResponse((result) => result.request().method() === 'DELETE');
    release();
    await response;
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(leave ? /\/bookmarks$/ : /\/home$/);
  });
}

const user = { userId: 'viewer', handle: 'viewer', nickname: '테스터', role: 'USER', status: 'ACTIVE' };
const createdAt = '2026-10-09T00:00:00Z';
const text = '선택 가능한 게시물 본문 @alpha #게임 a@abc.com @ABC @ab @abcdefghijklmnopqrstu';
const post = {
  postId: 'post-1', author: '작성자', authorHandle: 'author', authorProfileImageUrl: null,
  authorVerifiedBadge: false, content: text, game: null, media: [],
  likes: 2, comments: 1, shares: 0, repostCount: 0, isReposted: false,
  likedByMe: false, bookmarkedByMe: false, mine: false, createdAt,
};
const profile = {
  id: 'viewer', handle: 'viewer', nickname: '테스터', bio: null, location: null, website: null,
  coverImageUrl: null, profileImageUrl: null, gameStats: {}, verifiedBadge: false,
  followersCount: 0, followingCount: 0, postCount: 1, mediaPostCount: 0, mediaItemCount: 0,
};
const cursor = { items: [], nextCursor: null, hasNext: false };

async function mockPostImages(page: Page, theme: 'light' | 'dark') {
  await mockApp(page, theme);
  const imagePost = { ...post, content: '이미지 게시물 @user.name #게임 @USER.name @user.한글', media: [1, 2].map((number) => ({
    mediaId: `image-${number}`, mediaType: 'IMAGE', mediaUrl: `/fe7-image-${number}.svg`, thumbnailUrl: null, sortOrder: number - 1,
  })) };
  await page.route('**/api/v1/feed?**', (route) => route.fulfill({
    json: { success: true, data: { ...cursor, items: [imagePost] } },
  }));
  await page.route('**/api/v1/posts/post-1', (route) => route.fulfill({ json: { success: true, data: imagePost } }));
  await page.route('**/fe7-image-*.svg', (route) => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#ffd500"/><circle cx="600" cy="400" r="160" fill="#2165bd"/></svg>',
  }));
}

async function mockApp(page: Page, theme: 'light' | 'dark') {
  const writes: Array<{ method: string; path: string; body: unknown }> = [];
  await page.addInitScript(({ theme, user }) => {
    localStorage.setItem('gamerin_user_settings', JSON.stringify({ theme }));
    localStorage.setItem('gamerin_user', JSON.stringify({
      id: user.userId, handle: user.handle, name: user.nickname, nickname: user.nickname,
      gameTier: 'Unranked', role: user.role, status: user.status,
    }));
  }, { theme, user });
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!['GET', 'HEAD'].includes(request.method())) {
      writes.push({ method: request.method(), path, body: request.postDataJSON() });
    }
    let data: unknown = null;
    if (path === '/api/v1/auth/refresh') data = { userId: user.userId, accessToken: 'fe7-test-token' };
    else if (path === '/api/v1/auth/me') data = user;
    else if (path === '/api/v1/feed') data = { ...cursor, items: [post, { ...post, postId: 'post-2', author: '다른 작성자', content: '두 번째 카드' }] };
    else if (/\/posts\/post-[12]$/.test(path)) data = post;
    else if (path.endsWith('/reposts')) data = {
      postId: 'post-1', isReposted: request.method() === 'POST',
      repostCount: request.method() === 'POST' ? 1 : 0, repostedAt: createdAt,
    };
    else if (path === '/api/v1/posts/post-1/comments') data = request.method() === 'POST' ? {
      commentId: 'created', author: '테스터', authorHandle: 'viewer', authorProfileImageUrl: null,
      authorVerifiedBadge: false, content: request.postDataJSON().content, createdAt, mine: true,
    } : [{
      commentId: 'comment-1', author: '댓글 작성자', authorHandle: 'commenter',
      authorProfileImageUrl: null, authorVerifiedBadge: false, content: '@bravo #댓글태그', createdAt, mine: false,
    }];
    else if (path.includes('/bookmark-collections')) data = [];
    else if (path === '/api/v1/users/me/bookmarks') data = { ...cursor, items: [post] };
    else if (path === '/api/v1/users/me' || path === '/api/v1/users/viewer') data = profile;
    else if (path === '/api/v1/users/viewer/posts') data = { ...cursor, items: [post] };
    else if (path === '/api/v1/users/alpha') {
      await route.fulfill({ status: 404, json: { success: false, message: '프로필을 찾을 수 없습니다.' } });
      return;
    } else if (path === '/api/v1/search') data = { accounts: [], posts: [post], hashtags: [] };
    else if (path === '/api/v1/search/posts' || path.includes('/hashtags/') && path.endsWith('/posts')) data = { ...cursor, items: [post] };
    else if (path === '/api/v1/notifications/unread-count') data = { unreadCount: 1 };
    else if (path === '/api/v1/notifications') data = { ...cursor, items: [{
      notificationId: 'n1', type: 'like', actor: { ...user, nickname: '알림 사용자', profileImageUrl: null },
      postId: 'post-1', read: true, createdAt,
    }] };
    else if (path === '/api/v1/games') data = [];
    else if (path === '/api/v1/reports/reasons') data = [];
    else if (path.endsWith('/media')) data = cursor;
    await route.fulfill({ json: { success: true, data } });
  });
  return writes;
}

for (const width of [375, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test.describe(`${width}px ${theme}`, () => {
      test.use({ viewport: { width, height: 1000 }, colorScheme: theme });
      test('메뉴·텍스트 선택·키보드·액션·멘션을 각각 조작한다', async ({ page }, info) => {
        await mockApp(page, theme);
        await page.goto('/home');
        if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/);
        else await expect(page.locator('html')).not.toHaveClass(/dark/);
        const article = page.locator('article').first();
        const overlay = article.getByRole('button', { name: '작성자님의 게시물 열기' });
        await expect(overlay).toBeVisible();
        await expect(article).not.toHaveAttribute('role');
        expect(await article.locator('button button, button a, a button').count()).toBe(0);
        await overlay.focus();
        await expect(overlay).toBeFocused();
        const ring = await overlay.evaluate((el) => getComputedStyle(el).boxShadow);
        expect(ring).not.toBe('none');
        await page.keyboard.press('Tab');
        await expect(article.getByRole('link').first()).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(article.getByRole('button', { name: '게시물 메뉴' })).toBeFocused();

        const menus = page.getByRole('button', { name: '게시물 메뉴' });
        await menus.nth(0).click(); await menus.nth(1).click();
        await expect(menus.nth(0)).toHaveAttribute('aria-expanded', 'false');
        await expect(menus.nth(1)).toHaveAttribute('aria-expanded', 'true');
        await page.keyboard.press('Escape');
        await expect(menus.nth(1)).toBeFocused();
        await expect(menus.nth(1)).toHaveAttribute('aria-expanded', 'false');
        const bell = page.getByRole('button', { name: '알림', exact: true });
        await bell.click();
        await expect(page.getByText('알림 사용자님이 게시글을 좋아합니다.')).toBeVisible();
        await expect(page.getByRole('button', { name: '알림 닫기' })).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(bell).toBeFocused();
        await bell.click();
        await page.getByRole('button', { name: '알림 닫기' }).click();
        await expect(bell).toHaveAttribute('aria-expanded', 'false');
        await expect(bell).toBeFocused();

        const body = article.locator('p').first();
        const textBox = await body.boundingBox();
        expect(textBox).not.toBeNull();
        await page.mouse.move(textBox!.x + 5, textBox!.y + 12);
        await page.mouse.down();
        await page.mouse.move(textBox!.x + Math.min(textBox!.width - 10, 180), textBox!.y + 12, { steps: 12 });
        await page.mouse.up();
        expect(await page.evaluate(() => window.getSelection()?.toString().length ?? 0)).toBeGreaterThan(0);
        await expect(overlay).toBeVisible();
        await page.evaluate(() => window.getSelection()?.removeAllRanges());
        await article.getByRole('button', { name: '좋아요 2개', pressed: false }).click();
        await expect(article.getByRole('button', { name: '좋아요 3개', pressed: true })).toBeVisible();
        await article.getByRole('button', { name: '리포스트', pressed: false }).click();
        const reposted = article.getByRole('button', { name: '리포스트', pressed: true });
        await expect(reposted).toHaveText('1');
        await expect(reposted).toBeEnabled();
        await reposted.click();
        await expect(article.getByRole('button', { name: '리포스트', pressed: false })).toHaveText('0');
        await expect(page).toHaveURL(/\/home$/);
        await article.getByRole('button', { name: '북마크 저장' }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(overlay).toBeVisible();
        const cardScreenshot = info.outputPath('card.png');
        await page.screenshot({ path: cardScreenshot, fullPage: true });
        await info.attach('card', { path: cardScreenshot, contentType: 'image/png' });
        await article.getByRole('link', { name: '@alpha' }).click();
        await expect(page).toHaveURL(/\/profile\/alpha$/);
        await expect(page.getByText('프로필을 찾을 수 없습니다.')).toBeVisible();

        await page.goto('/home');
        await page.getByRole('button', { name: '작성자님의 게시물 열기', exact: true }).focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('textbox', { name: '댓글 입력' })).toBeVisible();
      });

      test('Windows IME의 조합 종료 직후 Enter를 차단하고 다음 Enter는 전송한다', async ({ page }) => {
        const writes = await mockApp(page, theme);
        await page.goto('/posts/post-1');
        const textarea = page.getByRole('textbox', { name: '댓글 입력' });
        await textarea.fill('가');
        await textarea.evaluate((element) => {
          element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
          element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '가' }));
          element.dispatchEvent(new KeyboardEvent('keydown', {
            bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', isComposing: false,
          }));
          element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
        });
        await expect(textarea).toHaveValue('가');
        expect(writes.filter((request) => request.path.endsWith('/comments'))).toHaveLength(0);
        await textarea.press('Enter');
        await expect(textarea).toHaveValue('');
        expect(writes.filter((request) => request.path.endsWith('/comments'))).toHaveLength(1);
      });

      test('등록된 댓글의 줄바꿈을 화면에서도 유지한다', async ({ page }) => {
        const writes = await mockApp(page, theme);
        await page.goto('/posts/post-1');
        const textarea = page.getByRole('textbox', { name: '댓글 입력' });
        await textarea.fill('댓글 첫 번째 줄');
        await textarea.press('Shift+Enter');
        await textarea.press('Shift+Enter');
        await textarea.press('End');
        await textarea.pressSequentially('댓글 두 번째 줄');
        const content = '댓글 첫 번째 줄\n\n댓글 두 번째 줄';
        await expect(textarea).toHaveValue(content);
        expect(writes.filter((request) => request.path.endsWith('/comments'))).toHaveLength(0);
        await textarea.press('Enter');
        await expect(textarea).toHaveValue('');
        expect(writes.filter((request) => request.path.endsWith('/comments'))).toEqual([
          { method: 'POST', path: '/api/v1/posts/post-1/comments', body: { content } },
        ]);
        const rendered = page.locator('p').filter({ hasText: '댓글 첫 번째 줄' });
        await expect(rendered).toBeVisible();
        expect(await rendered.textContent()).toBe(content);
        expect(await rendered.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe('pre-wrap');
        const lines = await rendered.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top))).size;
        });
        expect(lines).toBeGreaterThanOrEqual(2);
      });

      test('댓글 form은 Enter·Shift+Enter·조합을 구분한다', async ({ page }, info) => {
        const writes = await mockApp(page, theme);
        await page.goto('/posts/post-1');
        const textarea = page.getByRole('textbox', { name: '댓글 입력' });
        await expect(textarea).toBeVisible();
        await expect(page.getByRole('link', { name: '@bravo' })).toHaveAttribute('href', '/profile/bravo');
        await expect(page.getByRole('link', { name: '#댓글태그' })).toHaveCount(0);
        await textarea.fill('한글');
        await textarea.dispatchEvent('compositionstart', { data: '글' });
        await textarea.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true });
        await textarea.dispatchEvent('compositionend', { data: '글' });
        await expect(textarea).toHaveValue('한글');
        expect(writes.filter((request) => request.path.endsWith('/comments'))).toHaveLength(0);
        await textarea.press('Shift+Enter');
        await expect(textarea).toHaveValue('한글\n');
        await textarea.press('Enter');
        await expect(textarea).toHaveValue('');
        expect(writes.filter((request) => request.path.endsWith('/comments'))).toEqual([
          { method: 'POST', path: '/api/v1/posts/post-1/comments', body: { content: '한글' } },
        ]);
        await page.getByRole('button', { name: '좋아요 2개', pressed: false }).click();
        await expect(page.getByRole('button', { name: '좋아요 3개', pressed: true })).toBeEnabled();
        await page.getByRole('button', { name: '리포스트', pressed: false }).click();
        const reposted = page.getByRole('button', { name: '리포스트', pressed: true });
        await expect(reposted).toHaveText('1');
        await expect(reposted).toBeEnabled();
        await reposted.click();
        await expect(page.getByRole('button', { name: '리포스트', pressed: false })).toHaveText('0');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
        const detailScreenshot = info.outputPath('detail.png');
        await page.screenshot({ path: detailScreenshot, fullPage: true });
        await info.attach('detail', { path: detailScreenshot, contentType: 'image/png' });
      });

      test('카드·상세 사진은 독립 확대되고 닫으면 해당 사진으로 포커스가 돌아온다', async ({ page }, info) => {
        await mockPostImages(page, theme);
        for (const path of ['/home', '/posts/post-1']) {
          await page.goto(path);
          const image = page.getByRole('button', { name: '게시물 이미지 2 확대 보기' });
          await expect(image).toBeVisible();
          await image.focus();
          const focusRing = image.locator('span[aria-hidden="true"]');
          await expect(focusRing).toHaveCSS('border-top-color', 'rgb(255, 255, 255)');
          expect(await focusRing.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe('none');
          await page.keyboard.press('Enter');
          const preview = page.getByRole('dialog', { name: '게시물 이미지 2 확대' });
          await expect(preview).toBeVisible();
          const expanded = preview.getByRole('img', { name: '확대된 게시물 이미지 2' });
          await expect(expanded).toHaveJSProperty('src', new URL('/fe7-image-2.svg', page.url()).href);
          await expect(expanded).toHaveJSProperty('naturalWidth', 1200);
          const close = preview.getByRole('button', { name: '이미지 확대 닫기' });
          await expect(close).toBeFocused();
          await page.keyboard.press('Tab');
          await expect(close).toBeFocused();
          await page.keyboard.press('Shift+Tab');
          await expect(close).toBeFocused();
          await expect(page).toHaveURL(new RegExp(`${path}$`));
          expect(await page.locator('article dialog, button button, button a, a button').count()).toBe(0);
          const box = await preview.boundingBox();
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width);
          expect(box!.height).toBeLessThanOrEqual(1000);
          const screenshot = info.outputPath(path === '/home' ? 'card-image-preview.png' : 'detail-image-preview.png');
          await page.screenshot({ path: screenshot, fullPage: true });
          await info.attach('image-preview', { path: screenshot, contentType: 'image/png' });
          await page.keyboard.press('Escape');
          await expect(preview).toHaveCount(0);
          await expect(image).toBeFocused();
          expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
          await page.keyboard.press('Space');
          await expect(preview).toBeVisible();
          await close.click();
          await expect(preview).toHaveCount(0);
          await expect(image).toBeFocused();
        }
      });
    });
  }
}

test('카드·상세의 리포스트 실패 복원과 본인 게시물 설명을 확인한다', async ({ page }) => {
  await mockApp(page, 'light');
  let repostAttempts = 0;
  await page.route('**/api/v1/posts/*/reposts', (route) => {
    repostAttempts += 1;
    return route.fulfill({
      status: 500, json: { success: false, message: '리포스트 실패 테스트' },
    });
  });
  for (const path of ['/home', '/posts/post-1']) {
    await page.goto(path);
    const button = page.getByRole('button', { name: '리포스트', pressed: false }).first();
    await button.click();
    await expect(button).toBeEnabled();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(button).toHaveText('0');
    await expect(button).toHaveAccessibleDescription('리포스트 실패 테스트');
  }
  expect(repostAttempts).toBe(2);
  await page.route('**/api/v1/feed?**', (route) => route.fulfill({
    json: { success: true, data: { ...cursor, items: [{ ...post, mine: true }] } },
  }));
  await page.route('**/api/v1/posts/post-1', (route) => route.fulfill({
    json: { success: true, data: { ...post, mine: true } },
  }));
  for (const path of ['/home', '/posts/post-1']) {
    await page.goto(path);
    const button = page.getByRole('button', { name: '리포스트', pressed: false });
    await expect(button).toBeDisabled();
    await expect(button).toHaveAccessibleDescription('본인 게시글은 리포스트할 수 없습니다.');
  }
  expect(repostAttempts).toBe(2);
});

test.describe('모바일 터치', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  for (const theme of ['light', 'dark'] as const) {
    test(`${theme}: 액션·멘션 터치와 본문 터치를 분리한다`, async ({ page }) => {
      await mockApp(page, theme);
      await page.goto('/home');
      const article = page.locator('article').first();
      await article.getByRole('button', { name: '좋아요 2개', pressed: false }).tap();
      await expect(article.getByRole('button', { name: '좋아요 3개', pressed: true })).toBeVisible();
      await expect(page).toHaveURL(/\/home$/);
      await article.getByRole('link', { name: '@alpha' }).tap();
      await expect(page).toHaveURL(/\/profile\/alpha$/);
      await page.goto('/home');
      await page.locator('article').first().locator('p').first().tap({ position: { x: 12, y: 12 } });
      await expect(page.getByRole('textbox', { name: '댓글 입력' })).toBeVisible();
    });
    test(`${theme}: 사진 터치는 확대만 열고 본문 터치는 상세를 연다`, async ({ page }) => {
      await mockPostImages(page, theme);
      await page.goto('/home');
      const image = page.getByRole('button', { name: '게시물 이미지 1 확대 보기' });
      await image.tap();
      const preview = page.getByRole('dialog', { name: '게시물 이미지 1 확대' });
      await expect(preview).toBeVisible();
      await expect(page).toHaveURL(/\/home$/);
      await preview.getByRole('button', { name: '이미지 확대 닫기' }).tap();
      await expect(preview).toHaveCount(0);
      await expect(image).toBeFocused();
      await page.locator('article').first().locator('p').first().tap({ position: { x: 8, y: 8 } });
      await expect(page.getByRole('textbox', { name: '댓글 입력' })).toBeVisible();
    });
  }
});

test('점은 카드·상세·댓글에서 핸들 구분자로 처리되고 원문은 보존된다', async ({ page }) => {
  await mockPostImages(page, 'light');
  await page.route('**/api/v1/posts/post-1/comments', (route) => route.fulfill({ json: { success: true, data: [{
    commentId: 'comment-1', author: '댓글 작성자', authorHandle: 'commenter', authorProfileImageUrl: null,
    authorVerifiedBadge: false, content: '@friend.name #댓글태그', createdAt, mine: false,
  }] } }));
  await page.route('**/api/v1/users/user', (route) => route.fulfill({
    status: 404, json: { success: false, message: '프로필을 찾을 수 없습니다.' },
  }));
  for (const path of ['/home', '/posts/post-1']) {
    await page.goto(path);
    const mentions = page.getByRole('link', { name: '@user', exact: true });
    await expect(mentions).toHaveCount(2);
    await expect(mentions.first()).toHaveAttribute('href', '/profile/user');
    await expect(page.getByRole('link', { name: '@user.name', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: '@USER.name', exact: true })).toHaveCount(0);
    await expect(page.getByText('이미지 게시물 @user.name #게임 @USER.name @user.한글', { exact: true })).toBeVisible();
    if (path.startsWith('/posts/')) {
      await expect(page.getByRole('link', { name: '@friend', exact: true })).toHaveAttribute('href', '/profile/friend');
      await expect(page.getByRole('link', { name: '#댓글태그' })).toHaveCount(0);
    }
    await mentions.first().click();
    await expect(page).toHaveURL(/\/profile\/user$/);
    await expect(page.getByText('프로필을 찾을 수 없습니다.')).toBeVisible();
  }
});

test('이미지 오류·배경 클릭·외부 화면 이동에도 확대 창과 배경 스크롤이 복구된다', async ({ page }) => {
  await mockPostImages(page, 'light');
  await page.route('**/fe7-image-2.svg', (route) => route.fulfill({ status: 404, body: 'missing image' }));
  await page.goto('/home');
  const broken = page.getByRole('button', { name: '게시물 이미지 2 확대 보기' });
  await broken.click();
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('이미지를 불러오지 못했습니다.');
  await page.getByRole('button', { name: '이미지 확대 닫기' }).click();
  await expect(broken).toBeFocused();
  const image = page.getByRole('button', { name: '게시물 이미지 1 확대 보기' });
  await image.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(image).toBeFocused();
  await image.click();
  // A queued route transition must unmount the native modal and restore scroll.
  await page.getByRole('link', { name: '북마크', exact: true }).first().evaluate((link) => {
    if (!(link instanceof HTMLAnchorElement)) throw new Error('북마크 링크를 찾을 수 없습니다.');
    link.click();
  });
  await expect(page).toHaveURL(/\/bookmarks$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});

test('새 이미지 확대 Esc와 뒤늦게 열린 알림 팝업 Esc가 동시에 처리되지 않는다', async ({ page }) => {
  await mockPostImages(page, 'light');
  await page.goto('/home');
  const image = page.getByRole('button', { name: '게시물 이미지 1 확대 보기' });
  await image.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const bell = page.locator('header button[aria-label="알림"]');
  await bell.evaluate((button) => {
    if (!(button instanceof HTMLButtonElement)) throw new Error('알림 버튼을 찾을 수 없습니다.');
    button.click();
  });
  await expect(bell).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(image).toBeFocused();
  await expect(bell).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(bell).toHaveAttribute('aria-expanded', 'false');
  await expect(bell).toBeFocused();
});

test('메시지 이미지 Esc와 공통 팝업 Esc가 한 번에 함께 실행되지 않는다', async ({ page }) => {
  await mockApp(page, 'light');
  const message = {
    id: 'message-1', senderId: 'recipient', text: '', read: true, createdAt,
    deliveryStatus: 'sent', sharedPost: null,
    attachments: [{ id: 'image-1', type: 'image', name: 'FE7 이미지', url: '/api/v1/messages/attachments/image-1' }],
  };
  const conversation = {
    id: 'conversation-1', recipient: { id: 'recipient', name: '테스트 대화상대', handle: '@recipient', role: 'USER', online: false },
    messages: [message], unreadCount: 0, updatedAt: createdAt,
  };
  await page.route('**/api/v1/messages/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/attachments/image-1')) {
      await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="green"/></svg>' });
      return;
    }
    if (path.endsWith('/stream')) {
      await route.fulfill({ contentType: 'text/event-stream', body: ': keepalive\n\n' });
      return;
    }
    const data = path.endsWith('/conversations') ? [conversation]
      : path.endsWith('/messages') ? { ...cursor, items: [message] }
        : path.endsWith('/stream-token') ? { expiresAt: '2026-10-10T00:00:00Z' } : null;
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto('/messages');
  await page.getByRole('button', { name: /테스트 대화상대/ }).click();
  await page.getByRole('button', { name: 'FE7 이미지 확대 보기' }).click();
  const imageDialog = page.getByRole('dialog', { name: 'FE7 이미지', exact: true });
  await expect(imageDialog).toBeVisible();
  const bell = page.getByRole('button', { name: '알림', exact: true });
  // Simulate an already queued popup activation while the existing image modal is open.
  await bell.evaluate((button) => {
    if (!(button instanceof HTMLButtonElement)) throw new Error('알림 버튼을 찾을 수 없습니다.');
    button.click();
  });
  await expect(bell).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(imageDialog).toHaveCount(0);
  await expect(bell).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(bell).toHaveAttribute('aria-expanded', 'false');
  await expect(bell).toBeFocused();
});

test('검색·북마크·프로필·해시태그에서도 카드 키보드 진입이 유지된다', async ({ page }) => {
  await mockApp(page, 'light');
  for (const path of ['/search?q=게임&tab=posts', '/bookmarks', '/profile/viewer', '/hashtags/게임']) {
    await page.goto(path);
    const overlay = page.getByRole('button', { name: '작성자님의 게시물 열기' }).first();
    await expect(overlay).toBeVisible();
    await overlay.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('textbox', { name: '댓글 입력' })).toBeVisible();
  }
});

test('본문·빈 영역 클릭과 비디오 컨트롤을 오버레이와 분리한다', async ({ page }) => {
  await mockApp(page, 'light');
  await page.route('**/api/v1/feed?**', (route) => route.fulfill({ json: { success: true, data: {
    ...cursor, items: [{ ...post, media: [{
      mediaId: 'video', mediaType: 'VIDEO', mediaUrl: '/fe7-test.webm', thumbnailUrl: null, sortOrder: 0,
    }] }],
  } } }));
  await page.route('**/fe7-test.webm', (route) => route.fulfill({ status: 204 }));
  await page.goto('/home');
  const article = page.locator('article').first();
  const video = article.locator('video');
  await expect(video).toBeVisible();
  // A local generated clip exercises native video controls without external media or uploads.
  await video.evaluate(async (element: HTMLVideoElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = 160; canvas.height = 90;
    canvas.getContext('2d')!.fillRect(0, 0, 160, 90);
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const clip = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    });
    recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 200));
    recorder.stop();
    // Keep this short fixture playing while the assertion polls its state.
    element.loop = true;
    element.src = URL.createObjectURL(await clip);
    for (const track of stream.getTracks()) track.stop();
    await new Promise<void>((resolve) => { element.onloadeddata = () => resolve(); });
  });
  await video.focus();
  await expect(video).toBeFocused();
  await page.keyboard.press('Space');
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(false);
  await expect(page).toHaveURL(/\/home$/);
  await video.click();
  await expect(page.getByRole('button', { name: '작성자님의 게시물 열기', exact: true })).toBeVisible();
  await article.locator('p').first().click({ position: { x: 12, y: 12 } });
  await expect(page.getByRole('textbox', { name: '댓글 입력' })).toBeVisible();
  await page.goto('/home');
  const box = await page.locator('article').first().boundingBox();
  await page.mouse.click(box!.x + box!.width - 12, box!.y + 100);
  await expect(page.getByRole('textbox', { name: '댓글 입력' })).toBeVisible();
});

test('댓글 성공 응답이 전송 중 변경한 좋아요·리포스트·북마크 상태를 보존한다', async ({ page }) => {
  await mockApp(page, 'light');
  let releaseComment!: () => void;
  const commentGate = new Promise<void>((resolve) => { releaseComment = resolve; });
  let commentAttempts = 0;
  let saved = false;
  await page.route('**/api/v1/bookmark-collections**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/bookmarks/post-1')) {
      saved = true;
      return route.fulfill({ json: { success: true, data: {
        postId: 'post-1', bookmarkedByMe: true, collectionIds: ['collection-a'],
        collection: {
          collectionId: 'collection-a', name: '동시 요청 검증 모음집', coverImageUrl: null,
          bookmarkCount: 1, containsPost: true, createdAt, updatedAt: createdAt,
        },
      } } });
    }
    return route.fulfill({ json: { success: true, data: [{
      collectionId: 'collection-a', name: '동시 요청 검증 모음집', coverImageUrl: null,
      bookmarkCount: saved ? 1 : 0, containsPost: saved, createdAt, updatedAt: createdAt,
    }] } });
  });
  await page.route('**/api/v1/posts/post-1/comments', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    commentAttempts += 1;
    await commentGate;
    await route.fulfill({ json: { success: true, data: {
      commentId: 'concurrent-comment', author: '테스터', authorHandle: 'viewer',
      authorProfileImageUrl: null, authorVerifiedBadge: false,
      content: route.request().postDataJSON().content, createdAt, mine: true,
    } } });
  });
  try {
    await page.goto('/posts/post-1');
    const input = page.getByRole('textbox', { name: '댓글 입력' });
    await input.fill('동시 요청 댓글');
    await input.press('Enter');
    await expect.poll(() => commentAttempts).toBe(1);
    await page.getByRole('button', { name: '좋아요 2개', pressed: false }).click();
    await expect(page.getByRole('button', { name: '좋아요 3개', pressed: true })).toBeVisible();
    await page.getByRole('button', { name: '리포스트', pressed: false }).click();
    await expect(page.getByRole('button', { name: '리포스트', pressed: true })).toHaveText('1');
    await page.getByRole('button', { name: '북마크 저장' }).click();
    const collection = page.getByRole('checkbox', { name: '동시 요청 검증 모음집' });
    await collection.click();
    await expect(collection).toBeChecked();
    await expect(page.getByRole('button', { name: '북마크 해제', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await input.fill('다음 댓글 초안');
    releaseComment();
    await expect(page.getByText('동시 요청 댓글', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '좋아요 3개', pressed: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '리포스트', pressed: true })).toHaveText('1');
    await expect(page.getByRole('button', { name: '북마크 해제', exact: true })).toBeVisible();
    await expect(input).toHaveValue('다음 댓글 초안');
    expect(commentAttempts).toBe(1);
  } finally { releaseComment(); }
});

test('문장 끝 점은 계정 조회 없이 평문으로 남고 카드·상세·댓글 링크에서 제외된다', async ({ page }) => {
  await mockApp(page, 'light');
  const mentionPost = { ...post, content: '안녕 @player. #게임' };
  await page.route('**/api/v1/feed?**', (route) => route.fulfill({ json: { success: true, data: { ...cursor, items: [mentionPost] } } }));
  await page.route('**/api/v1/posts/post-1', (route) => route.fulfill({ json: { success: true, data: mentionPost } }));
  await page.route('**/api/v1/posts/post-1/comments', (route) => route.fulfill({ json: { success: true, data: [{
    commentId: 'comment-1', author: '댓글 작성자', authorHandle: 'commenter', authorProfileImageUrl: null,
    authorVerifiedBadge: false, content: '@player. #댓글태그', createdAt, mine: false,
  }] } }));
  const lookups: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/users/player')) lookups.push(request.url());
  });
  for (const path of ['/home', '/posts/post-1']) {
    await page.goto(path);
    const mentions = page.getByRole('link', { name: '@player', exact: true });
    await expect(mentions).toHaveCount(path === '/home' ? 1 : 2);
    for (const mention of await mentions.all()) await expect(mention).toHaveAttribute('href', '/profile/player');
    await expect(page.getByRole('link', { name: '@player.', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: '#댓글태그' })).toHaveCount(0);
    await expect(page.getByText('안녕 @player. #게임', { exact: true })).toBeVisible();
  }
  expect(lookups).toEqual([]);
});

test('점으로 끝나는 없는 핸들도 점 없는 프로필 찾을 수 없음 화면으로 간다', async ({ page }) => {
  await mockApp(page, 'light');
  await page.route('**/api/v1/feed?**', (route) => route.fulfill({ json: { success: true, data: {
    ...cursor, items: [{ ...post, content: '@exact. @unknown. @abcdefghijklmnopqrst.' }],
  } } }));
  const lookups: string[] = [];
  await page.route('**/api/v1/users/unknown*', (route) => {
    lookups.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 404, json: { success: false, message: '사용자를 찾을 수 없습니다.' } });
  });
  await page.goto('/home');
  await expect(page.getByRole('link', { name: '@exact', exact: true })).toHaveAttribute('href', '/profile/exact');
  await expect(page.getByRole('link', { name: '@abcdefghijklmnopqrst', exact: true })).toHaveAttribute('href', '/profile/abcdefghijklmnopqrst');
  const unknown = page.getByRole('link', { name: '@unknown', exact: true });
  await expect(unknown).toHaveAttribute('href', '/profile/unknown');
  expect(lookups).toEqual([]);
  await unknown.click();
  await expect(page).toHaveURL(/\/profile\/unknown$/);
  await expect(page.getByText('사용자를 찾을 수 없습니다.', { exact: true })).toBeVisible();
  expect(lookups).toEqual(['/api/v1/users/unknown']);
});

test('점 앞의 잘못된 후보를 잘라서 링크하지 않고 점 뒤의 @도 멘션이 아니다', async ({ page }) => {
  await mockApp(page, 'light');
  await page.route('**/api/v1/feed?**', (route) => route.fulfill({ json: { success: true, data: {
    ...cursor, items: [{ ...post, content: '@ab.name @ABC.name @abcD. @abc한. @abcdefghijklmnopqrstu. .@alpha @.alpha' }],
  } } }));
  await page.goto('/home');
  const article = page.locator('article').first();
  await expect(article.getByText('@ab.name @ABC.name @abcD. @abc한. @abcdefghijklmnopqrstu. .@alpha @.alpha', { exact: true })).toBeVisible();
  await expect(article.getByRole('link', { name: /^@/ })).toHaveCount(0);
});

for (const width of [375, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test.describe(`멘션 대비 ${width}px ${theme}`, () => {
      test.use({ viewport: { width, height: 1000 }, colorScheme: theme });
      test('카드·상세·댓글 멘션과 해시태그의 기본·호버 글자 대비가 4.5 이상이다', async ({ page }, info) => {
        await mockApp(page, theme);
        for (const path of ['/home', '/posts/post-1']) {
          await page.goto(path);
          const names = path === '/home' ? ['@alpha', '#게임'] : ['@alpha', '#게임', '@bravo'];
          for (const name of names) {
            const link = page.getByRole('link', { name, exact: true });
            await expect(link).toBeVisible();
            for (const hover of [false, true]) {
              if (hover) await link.hover();
              else await page.mouse.move(0, 0);
              await expect.poll(async () => link.evaluate((element) => {
                const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
                const context = canvas.getContext('2d')!;
                const rgb = (color: string) => {
                  context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1);
                  return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
                };
                const luminance = (color: number[]) => color.map((channel) => channel / 255)
                  .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
                  .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
                let parent: Element | null = element;
                while (parent && getComputedStyle(parent).backgroundColor === 'rgba(0, 0, 0, 0)') parent = parent.parentElement;
                if (!parent) throw new Error('배경색을 찾을 수 없습니다.');
                const foreground = luminance(rgb(getComputedStyle(element).color));
                const background = luminance(rgb(getComputedStyle(parent).backgroundColor));
                return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
              })).toBeGreaterThanOrEqual(4.5);
            }
          }
          await page.screenshot({ path: info.outputPath(path === '/home' ? 'mention-card-contrast.png' : 'mention-detail-contrast.png'), fullPage: true });
        }
      });
    });
  }
}
