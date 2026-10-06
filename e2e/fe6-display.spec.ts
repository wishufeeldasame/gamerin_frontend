import { expect, test, type Page, type TestInfo } from '@playwright/test';

const createdAt = '2026-10-06T06:04:00Z';
const actor = { userId: 'viewer', handle: 'viewer', nickname: '테스터', role: 'USER', status: 'ACTIVE' };
const post = {
  postId: 'post-1', author: '작성자', authorHandle: 'author', authorProfileImageUrl: null,
  authorVerifiedBadge: false, content: '한국어 화면 확인용 게시물', game: null, media: [],
  likes: 0, comments: 1, shares: 0, repostCount: 0, isReposted: false,
  reposterInfo: { userId: 'reposter', nickname: '리포스터', repostedAt: '2026-09-29T06:05:00Z' },
  likedByMe: false, bookmarkedByMe: false, mine: false, createdAt,
};
const profile = {
  id: 'viewer', handle: 'viewer', nickname: '테스터', bio: null, location: null, website: null,
  coverImageUrl: null, profileImageUrl: null, gameStats: {}, verifiedBadge: false,
  followersCount: 0, followingCount: 0, postCount: 0, mediaPostCount: 0, mediaItemCount: 0,
};
const conversation = {
  id: 'conversation-1', recipient: { id: 'recipient', name: '대화상대', handle: '@MixedCase', role: 'USER', online: false },
  messages: [], unreadCount: 0, updatedAt: createdAt,
};
const cursorPage = { items: [], nextCursor: null, hasNext: false };
const emptyPage = { content: [], totalPages: 0, totalElements: 0, number: 0, size: 10, first: true, last: true, empty: true };

async function mockApp(page: Page, theme: 'light' | 'dark', admin = false) {
  const user = { ...actor, role: admin ? 'ROLE_ADMIN' : actor.role };
  await page.addInitScript(({ user, theme }) => {
    // 날짜만 모의한다. performance와 document.timeline은 같은 실제 시간축을 유지해야 한다.
    const NativeDate = Date;
    const startedAt = NativeDate.now();
    const displayNow = () => NativeDate.UTC(2026, 9, 6, 6, 5) + NativeDate.now() - startedAt;
    window.Date = new Proxy(NativeDate, {
      construct: (target, args, newTarget) => Reflect.construct(target, args.length ? args : [displayNow()], newTarget),
      apply: () => new NativeDate(displayNow()).toString(),
      get: (target, property, receiver) => property === 'now' ? displayNow : Reflect.get(target, property, receiver),
    });
    localStorage.setItem('gamerin_user', JSON.stringify({
      id: user.userId, name: user.nickname, nickname: user.nickname, handle: user.handle,
      gameTier: 'Unranked', role: user.role, status: user.status,
    }));
    localStorage.setItem('gamerin_theme', theme);
  }, { user, theme });
  // 모든 API를 목업해 실제 백엔드·인증 세션에 영향을 주지 않는다.
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = null;
    if (path === '/api/v1/auth/refresh') data = { accessToken: 'fe6-test-token' };
    else if (path === '/api/v1/auth/me') data = user;
    else if (path === '/api/v1/feed') data = { ...cursorPage, items: [post] };
    else if (path === '/api/v1/posts/post-1') data = post;
    else if (path === '/api/v1/posts/post-1/comments') data = [{
      commentId: 'comment-1', author: '댓글 작성자', authorHandle: 'commenter',
      authorProfileImageUrl: null, authorVerifiedBadge: false, content: '한국어 댓글', createdAt, mine: false,
    }];
    else if (path === '/api/v1/users/me' || path === '/api/v1/users/viewer') data = profile;
    else if (/\/users\/viewer\/(posts|media)$/.test(path)) data = cursorPage;
    else if (path.includes('/bookmark-collections')) data = [];
    else if (path === '/api/v1/notifications/unread-count') data = { unreadCount: 1 };
    else if (path === '/api/v1/notifications') data = { ...cursorPage, items: [{
      notificationId: 'notification-1', type: 'like', actor: { ...actor, verifiedBadge: false, profileImageUrl: null },
      postId: 'post-1', read: false, createdAt,
    }] };
    else if (path === '/api/v1/messages/conversations') data = [conversation];
    else if (path.endsWith('/conversation-1/messages')) data = cursorPage;
    else if (path.endsWith('/recipients')) data = [conversation.recipient];
    else if (path.endsWith('/stream-token')) data = { expiresAt: '2026-10-06T07:00:00Z' };
    else if (path.endsWith('/stream')) {
      await route.fulfill({ contentType: 'text/event-stream', body: ': keepalive\n\n' });
      return;
    } else if (path === '/api/v1/games') data = [{ code: 'PUBG', name: 'PUBG' }];
    else if (path.endsWith('/balance')) data = { currentBalance: 0 };
    else if (path.startsWith('/api/v1/mentoring/') || path.endsWith('/transactions')) data = path.endsWith('/mentors/me') ? null : emptyPage;
    else if (path === '/api/v1/reports/reasons') data = [];
    else if (path.startsWith('/api/v1/admin/')) data = emptyPage;
    await route.fulfill({ json: { success: true, data } });
  });
}

async function checkLayout(page: Page, info: TestInfo, name: string) {
  try {
    await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLElement>('.fixed[style], .fixed [style]'))
      .every((element) => !element.style.opacity || Number(getComputedStyle(element).opacity) >= 0.999));
  } catch (error) {
    const state = await page.evaluate(() => ({
      elements: Array.from(document.querySelectorAll<HTMLElement>('.fixed[style], .fixed [style]'))
        .filter((element) => element.style.opacity && Number(getComputedStyle(element).opacity) < 0.999)
        .map((element) => ({ className: element.className, style: element.getAttribute('style'), opacity: getComputedStyle(element).opacity })),
      animations: document.getAnimations().map((animation) => ({
        playState: animation.playState, currentTime: animation.currentTime, startTime: animation.startTime,
      })),
      now: performance.now(),
    }));
    await info.attach(name + '-animation-state', { body: JSON.stringify(state), contentType: 'application/json' });
    throw error;
  }
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  // 줄바꿈은 허용하되 고정 너비 버튼의 한국어 문구가 잘리는지 확인한다.
  const clipped = await page.locator('button').evaluateAll((buttons) => buttons.filter((button) => {
    const rect = button.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && /[가-힣]/.test(button.textContent ?? '') &&
      button.scrollWidth > button.clientWidth + 2 && getComputedStyle(button).overflowX !== 'visible';
  }).map((button) => button.textContent?.trim()));
  expect(clipped).toEqual([]);
  const screenshotPath = info.outputPath(name + '.png');
  // 실제 애니메이션 상태에 개입하지 않고 완료된 화면을 캡처한다.
  await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'allow' });
  await info.attach(name, { path: screenshotPath, contentType: 'image/png' });
}

for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 1000 }]) {
  for (const theme of ['light', 'dark'] as const) {
    test.describe(`${viewport.width}px ${theme}`, () => {
      test.use({ viewport, colorScheme: theme, timezoneId: 'Asia/Seoul' });

      test('사용자 화면 한국어 문구와 시간 요소가 넘치지 않는다', async ({ page }, info) => {
        await mockApp(page, theme);
        await page.goto('/home');
        await expect(page.getByText('한국어 화면 확인용 게시물')).toBeVisible();
        await expect(page.locator('time').filter({ hasText: '1분 전' }).first()).toHaveAttribute('title', '2026년 10월 6일 오후 3:04');
        await expect(page.locator('time').filter({ hasText: '9월 29일' })).toHaveAttribute('datetime', '2026-09-29T06:05:00.000Z');
        if (viewport.width >= 1024) await expect(page.getByText('미배치')).toHaveCount(2);
        await checkLayout(page, info, 'home');
        await page.getByRole('button', { name: '알림', exact: true }).click();
        await expect(page.getByText('테스터님이 게시글을 좋아합니다.')).toBeVisible();
        await expect(page.locator('time').last()).toHaveAttribute('title', '2026년 10월 6일 오후 3:04');
        await checkLayout(page, info, 'notifications');

        await page.goto('/posts/post-1');
        await expect(page.getByText('한국어 댓글', { exact: true })).toBeVisible();
        await expect(page.getByPlaceholder('댓글을 남겨보세요...')).toBeVisible();
        await expect(page.locator('time')).toHaveCount(2);
        await checkLayout(page, info, 'post-detail');

        await page.goto('/messages');
        const card = page.getByRole('button', { name: /대화상대/ });
        await expect(card).toBeVisible();
        await page.getByPlaceholder('대화 또는 사용자 검색').fill('USER');
        await expect(card).toBeVisible();
        await expect(page.getByText('USER', { exact: true })).toHaveCount(0);
        await page.getByPlaceholder('대화 또는 사용자 검색').fill('');
        await checkLayout(page, info, 'messages-list');
        await card.click();
        await expect(page.getByText('@MixedCase', { exact: true }).last()).toBeVisible();
        await expect(page.getByText('USER', { exact: true })).toHaveCount(0);
        await checkLayout(page, info, 'messages-chat');

        await page.goto('/profile/viewer');
        await expect(page.getByRole('button', { name: '프로필 수정', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: '게시물', exact: true })).toBeVisible();
        await checkLayout(page, info, 'profile');
        await page.getByRole('button', { name: '프로필 수정', exact: true }).click();
        await expect(page.getByPlaceholder('이름을 입력하세요')).toBeVisible();
        await expect(page.getByRole('button', { name: '저장', exact: true })).toBeVisible();
        await checkLayout(page, info, 'edit-profile');

        await page.goto('/profile/viewer');
        await page.getByRole('button', { name: '전적', exact: true }).click();
        await page.getByRole('button', { name: '전적 추가', exact: true }).click();
        await expect(page.getByText('게임 전적 연동', { exact: true })).toBeVisible();
        await expect(page.getByText('등급, 승률, 킬/데스/어시스트 비율 연동', { exact: true })).toBeVisible();
        await expect(page.getByText(/^Sync /)).toHaveCount(0);
        const overlappingGameLabels = await page.getByRole('button', { name: '연결', exact: true })
          .evaluateAll((buttons) => buttons.flatMap((button) => {
            const text = button.parentElement?.querySelector('h3')?.parentElement;
            if (!text) return ['전적 설명 영역 없음'];
            return text.getBoundingClientRect().right > button.getBoundingClientRect().left - 1
              ? [text.textContent?.trim()] : [];
          }));
        expect(overlappingGameLabels).toEqual([]);
        await checkLayout(page, info, 'game-stats');

        await page.goto('/settings');
        await page.getByRole('button', { name: '테마/언어', exact: true }).click();
        await expect(page.getByRole('option', { name: '영어', exact: true })).toHaveAttribute('value', 'en');
        await expect(page.getByRole('option', { name: '일본어', exact: true })).toHaveAttribute('value', 'ja');
        await expect(page.getByRole('option', { name: '중국어', exact: true })).toHaveAttribute('value', 'zh');
        await checkLayout(page, info, 'settings');

        await page.goto('/mentoring');
        await expect(page.getByRole('heading', { name: '멘토링', exact: true })).toBeVisible();
        await expect(page.getByText('프로그램 둘러보기', { exact: true })).toBeVisible();
        await checkLayout(page, info, 'mentoring-find');
        await page.getByRole('button', { name: '내 멘토링', exact: true }).click();
        await expect(page.getByText('마일리지', { exact: true })).toBeVisible();
        await checkLayout(page, info, 'mentoring');
      });

      test('관리자 콘솔과 사용자 검색 안내가 한국어이며 넘치지 않는다', async ({ page }, info) => {
        await mockApp(page, theme, true);
        await page.goto('/admin/reports');
        if (viewport.width < 1024) await page.getByRole('button', { name: '관리자 메뉴 열기' }).click();
        await expect(page.getByText('관리자 콘솔', { exact: true }).filter({ visible: true })).toBeVisible();
        await checkLayout(page, info, 'admin-reports');

        await page.goto('/admin/users');
        await expect(page.getByRole('searchbox', { name: '사용자 검색' })).toHaveAttribute(
          'placeholder', '핸들 · 닉네임 검색',
        );
        await expect(page.getByPlaceholder('Handle · Nickname 검색')).toHaveCount(0);
        await expect(page.getByText('@gamer01', { exact: true })).toBeVisible();
        await checkLayout(page, info, 'admin-users');
      });
    });
  }
}
