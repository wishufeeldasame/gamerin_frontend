import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

const account = { userId: 'viewer', handle: 'viewer', nickname: '테스터', role: 'USER', status: 'ACTIVE' };
const createdAt = '2026-10-09T06:00:00Z';
const post = {
  postId: 'post-1', author: '작성자', authorHandle: 'author', authorProfileImageUrl: null,
  authorVerifiedBadge: false, content: '다크 모드 확인용 게시물', game: null, media: [],
  likes: 0, comments: 1, shares: 0, repostCount: 0, isReposted: false,
  likedByMe: false, bookmarkedByMe: false, mine: false, createdAt,
};
const messages = ['받은 메시지', '보낸 메시지'].map((text, index) => ({
  id: `message-${index}`, senderId: index ? 'me' : 'recipient', text, createdAt,
  read: true, deliveryStatus: 'sent', attachments: [], sharedPost: null,
}));
const recipient = { id: 'recipient', name: '대화상대', handle: '@recipient', role: 'USER', online: false };
const profile = {
  id: 'viewer', handle: 'viewer', nickname: '테스터', bio: null, location: null, website: null,
  coverImageUrl: null, profileImageUrl: null, gameStats: {}, verifiedBadge: false,
  followersCount: 0, followingCount: 0, postCount: 0, mediaPostCount: 0, mediaItemCount: 0,
};
const cursor = { items: [], nextCursor: null, hasNext: false };

async function mockApp(page: Page, theme: 'light' | 'dark', anonymous = false) {
  await page.addInitScript(({ account, theme, anonymous }) => {
    localStorage.setItem('gamerin_user_settings', JSON.stringify({ theme }));
    if (!anonymous) localStorage.setItem('gamerin_user', JSON.stringify({
      id: account.userId, name: account.nickname, nickname: account.nickname,
      handle: account.handle, role: account.role, status: account.status, gameTier: 'Unranked',
    }));
  }, { account, theme, anonymous });
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = null;
    if (anonymous && path.startsWith('/api/v1/auth/')) {
      await route.fulfill({ status: 401, json: { success: false, message: '로그인이 필요합니다.' } }); return;
    }
    if (path.endsWith('/auth/refresh')) data = { userId: account.userId, accessToken: 'fe8-test-token' };
    else if (path.endsWith('/auth/me')) data = account;
    else if (path === '/api/v1/feed') data = { ...cursor, items: [post] };
    else if (path === '/api/v1/posts/post-1') data = post;
    else if (path.endsWith('/post-1/comments')) data = [{ commentId: 'comment-1', author: '댓글 작성자', authorHandle: 'commenter', content: '댓글 내용', createdAt, mine: false }];
    else if (path === '/api/v1/users/me' || path === '/api/v1/users/viewer') data = profile;
    else if (/\/users\/viewer\/(posts|media)$/.test(path)) data = cursor;
    else if (path.includes('/bookmark-collections')) data = [];
    else if (path.endsWith('/notifications/unread-count')) data = { unreadCount: 1 };
    else if (path.endsWith('/notifications')) data = { ...cursor, items: [{ notificationId: 'notification-1', type: 'like', actor: { ...account, verifiedBadge: false, profileImageUrl: null }, postId: 'post-1', read: false, createdAt }] };
    else if (path.endsWith('/messages/conversations')) data = [{ id: 'conversation-1', recipient, messages, unreadCount: 0, updatedAt: createdAt }];
    else if (path.endsWith('/conversation-1/messages')) data = { ...cursor, items: messages };
    else if (path.endsWith('/recipients')) data = [recipient];
    else if (path.endsWith('/stream')) { await route.fulfill({ contentType: 'text/event-stream', body: ': keepalive\n\n' }); return; }
    else if (path.endsWith('/stream-token')) data = { expiresAt: '2099-01-01T00:00:00Z' };
    else if (path.endsWith('/reports/reasons')) data = [{ code: 'SPAM', label: '스팸' }, { code: 'OTHER', label: '기타' }];
    else if (path === '/api/v1/reports') {
      await route.fulfill({ status: 500, json: { success: false, message: '신고 접수 실패 테스트' } }); return;
    }
    await route.fulfill({ json: { success: true, data } });
  });
}

// Composite transparent ancestor backgrounds. The assertion explicitly rejects gradients
// instead of claiming a contrast measurement against an unknown background image.
async function contrast(locator: Locator, placeholder = false) {
  return locator.evaluate((element, placeholder) => {
    const rgba = (color: string) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d')!; context.fillStyle = color; context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    };
    const over = (foreground: number[], background: number[]) => [0, 1, 2]
      .map(i => foreground[i] * foreground[3] / 255 + background[i] * (1 - foreground[3] / 255)).concat(255);
    const luminance = (color: number[]) => color.slice(0, 3).map(value => {
      value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    const backgrounds: number[][] = [];
    for (let node: Element | null = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.backgroundImage !== 'none') throw new Error('Contrast requires an image-free background');
      backgrounds.unshift(rgba(style.backgroundColor));
    }
    let background = [255, 255, 255, 255];
    for (const color of backgrounds) background = over(color, background);
    const foreground = over(rgba(getComputedStyle(element, placeholder ? '::placeholder' : null).color), background);
    const a = luminance(foreground), b = luminance(background);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  }, placeholder);
}

async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const path = info.outputPath(name + '.png');
  await page.screenshot({ path, fullPage: true });
  await info.attach(name, { path, contentType: 'image/png' });
}

for (const width of [390, 1440]) {
  test.describe(`${width}px dark`, () => {
    test.use({ viewport: { width, height: 900 }, colorScheme: 'dark', timezoneId: 'Asia/Seoul' });
    test('home tabs, composer, notifications and menu', async ({ page }, info) => {
      await mockApp(page, 'dark'); await page.goto('/home');
      const active = page.getByRole('button', { name: '추천', exact: true });
      await expect(active).toHaveAttribute('aria-pressed', 'true');
      expect(await contrast(active)).toBeGreaterThanOrEqual(4.5);
      expect(await contrast(page.getByRole('button', { name: '팔로잉', exact: true }))).toBeGreaterThanOrEqual(4.5);
      expect(await contrast(page.getByPlaceholder('무슨 생각을 하고 있나요?'), true)).toBeGreaterThanOrEqual(4.5);
      expect(await contrast(page.getByPlaceholder('외부 링크 URL'), true)).toBeGreaterThanOrEqual(4.5);
      await capture(page, info, 'home');
      await page.getByRole('button', { name: '게시물 메뉴', exact: true }).click();
      await capture(page, info, 'post-menu'); await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: '게시물 메뉴', exact: true })).toBeFocused();
      await page.getByRole('button', { name: '알림', exact: true }).click();
      const notification = page.getByText('테스터님이 게시글을 좋아합니다.');
      await expect(notification).toBeVisible(); expect(await contrast(notification)).toBeGreaterThanOrEqual(4.5);
      await capture(page, info, 'notifications');
    });
    test('chat header, both message bubbles and time', async ({ page }, info) => {
      await mockApp(page, 'dark'); await page.goto('/messages');
      await page.getByRole('button', { name: /대화상대/ }).click();
      await expect(page.getByText('받은 메시지', { exact: true })).toBeVisible();
      expect(await contrast(page.locator('p').filter({ hasText: /^대화상대$/ }).last())).toBeGreaterThanOrEqual(4.5);
      expect(await contrast(page.getByText('받은 메시지', { exact: true }))).toBeGreaterThanOrEqual(4.5);
      expect(await contrast(page.getByText('보낸 메시지', { exact: true }).last())).toBeGreaterThanOrEqual(4.5);
      expect(await contrast(page.getByText('오후 03:00', { exact: true }))).toBeGreaterThanOrEqual(4.5);
      expect(await contrast(page.getByText('읽음 오후 03:00', { exact: true }))).toBeGreaterThanOrEqual(4.5);
      expect(await contrast(page.getByPlaceholder('대화상대님에게 메시지 보내기'), true)).toBeGreaterThanOrEqual(4.5);
      await capture(page, info, 'messages');
    });
    test('profile editor and game stats cards', async ({ page }, info) => {
      await mockApp(page, 'dark'); await page.goto('/profile/viewer');
      await page.getByRole('button', { name: '프로필 수정', exact: true }).click();
      const title = page.getByRole('heading', { name: '프로필 수정', exact: true });
      await expect(title).toBeVisible();
      await expect.poll(() => contrast(title)).toBeGreaterThanOrEqual(4.5);
      expect(await contrast(page.getByRole('button', { name: '커버 이미지 초기화' }))).toBeGreaterThanOrEqual(4.5);
      expect(await contrast(page.getByPlaceholder('이름을 입력하세요'), true)).toBeGreaterThanOrEqual(4.5);
      await capture(page, info, 'edit-profile');
      await page.goto('/profile/viewer'); await page.getByRole('button', { name: '전적', exact: true }).click();
      await page.getByRole('button', { name: '전적 추가', exact: true }).click();
      const game = page.getByRole('heading', { name: 'League of Legends', exact: true });
      await expect(game).toBeVisible(); await expect.poll(() => contrast(game)).toBeGreaterThanOrEqual(4.5);
      expect(await contrast(page.getByText('등급, 승률, 킬/데스/어시스트 비율 연동', { exact: true }))).toBeGreaterThanOrEqual(4.5);
      await capture(page, info, 'game-stats');
    });
    test('share inputs, report selection, confirmation and failure', async ({ page }, info) => {
      await mockApp(page, 'dark'); await page.goto('/posts/post-1');
      expect(await contrast(page.getByRole('textbox', { name: '댓글 입력' }), true)).toBeGreaterThanOrEqual(4.5);
      await page.getByRole('button', { name: '게시물 공유', exact: true }).click();
      expect(await contrast(page.getByPlaceholder('이름 또는 핸들 검색'), true)).toBeGreaterThanOrEqual(4.5);
      expect(await contrast(page.getByPlaceholder('메시지 추가...'), true)).toBeGreaterThanOrEqual(4.5);
      await page.getByRole('button', { name: /대화상대/ }).click(); await capture(page, info, 'share-selected');
      await page.getByRole('button', { name: '닫기', exact: true }).click();
      await page.getByRole('button', { name: '게시물 메뉴', exact: true }).click();
      await page.getByRole('button', { name: '게시물 신고', exact: true }).click();
      await page.getByRole('button', { name: '스팸', exact: true }).click();
      expect(await contrast(page.getByText('스팸', { exact: true }))).toBeGreaterThanOrEqual(4.5);
      expect(await contrast(page.getByRole('textbox', { name: '신고 상세 내용' }), true)).toBeGreaterThanOrEqual(4.5);
      await expect(page.getByRole('button', { name: '신고 접수', exact: true })).toBeEnabled();
      await expect.poll(() => contrast(page.getByRole('button', { name: '신고 접수', exact: true }))).toBeGreaterThanOrEqual(4.5);
      await capture(page, info, 'report-selected');
      await page.getByRole('button', { name: '신고 접수', exact: true }).click();
      await expect(page.getByRole('heading', { name: '신고하시겠습니까?' })).toBeVisible();
      await capture(page, info, 'report-confirm');
      await page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: '신고하시겠습니까?' }) }).getByRole('button', { name: '신고 접수', exact: true }).click();
      const error = page.getByRole('alert').filter({ hasText: '신고 접수 실패 테스트' });
      await expect(error).toBeVisible(); expect(await contrast(error)).toBeGreaterThanOrEqual(4.5);
      await capture(page, info, 'report-error');
    });
    test('collection creation uses dark text on brand yellow', async ({ page }, info) => {
      await mockApp(page, 'dark'); await page.goto('/home');
      await page.getByRole('button', { name: '북마크 저장', exact: true }).click();
      await page.getByRole('button', { name: '새 모음집 만들기' }).click();
      expect(await contrast(page.getByRole('button', { name: '만들기', exact: true }))).toBeGreaterThanOrEqual(4.5);
      await capture(page, info, 'collection');
    });
    test('common auth shell, placeholder and keyboard focus', async ({ page }, info) => {
      await mockApp(page, 'dark', true); await page.goto('/auth/forgot-password');
      const input = page.getByPlaceholder('아이디 입력'); await expect(input).toBeVisible();
      expect(await contrast(input, true)).toBeGreaterThanOrEqual(4.5);
      await input.focus(); await expect(input).toHaveCSS('border-color', 'rgb(245, 185, 61)');
      await page.keyboard.press('Tab'); await expect(input).not.toBeFocused();
      await capture(page, info, 'auth');
    });
    test('auth invalid border and reset variant preserve validation', async ({ page }, info) => {
      await mockApp(page, 'dark', true); await page.goto('/auth/forgot-password');
      const handle = page.getByPlaceholder('아이디 입력'); await handle.fill('viewer');
      await page.getByRole('button', { name: '비밀번호 재설정 메일 받기' }).click();
      const error = page.getByText('요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.', { exact: true });
      await expect(error).toBeVisible();
      await expect.poll(() => handle.evaluate(element => getComputedStyle(element).borderColor)).toBe('oklch(0.704 0.191 22.216)');
      expect(await contrast(error)).toBeGreaterThanOrEqual(4.5);
      await capture(page, info, 'auth-invalid');
      await page.goto('/auth/reset-password?token=fe8-fixture');
      const password = page.getByPlaceholder('새 비밀번호', { exact: true }); await expect(password).toBeVisible();
      expect(await contrast(password, true)).toBeGreaterThanOrEqual(4.5);
      await password.focus(); await expect(password).toHaveCSS('border-color', 'rgb(245, 185, 61)');
      await password.fill('short');
      await expect.poll(() => password.evaluate(element => getComputedStyle(element).borderColor)).toBe('oklch(0.704 0.191 22.216)');
      await expect(page.getByRole('button', { name: '비밀번호 변경하기' })).toBeDisabled();
      await capture(page, info, 'reset-invalid');
    });
    test('existing toast and confirmation remain dark and keyboard accessible', async ({ page }, info) => {
      await mockApp(page, 'dark'); await page.goto('/settings');
      await page.getByRole('button', { name: '비밀번호 변경', exact: true }).click();
      const error = page.getByRole('alert').filter({ hasText: '비밀번호 입력칸을 모두 채워주세요' });
      await expect(error).toBeVisible(); expect(await contrast(error.locator('p'))).toBeGreaterThanOrEqual(4.5);
      await capture(page, info, 'toast');
      await page.getByRole('button', { name: '알림 닫기' }).click();
      await page.route('**/api/v1/posts/post-1', route => route.fulfill({ json: { success: true, data: { ...post, mine: true, authorHandle: 'viewer' } } }));
      await page.goto('/posts/post-1'); await page.getByRole('button', { name: '게시물 메뉴', exact: true }).click();
      await page.getByRole('button', { name: '삭제', exact: true }).click();
      const dialog = page.getByRole('alertdialog'); await expect(dialog).toBeVisible();
      expect(await contrast(dialog.locator('p'))).toBeGreaterThanOrEqual(4.5);
      await capture(page, info, 'confirm'); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
    });
  });
}
