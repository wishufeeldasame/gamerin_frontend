import { expect, test, type Locator, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { auditPost, auditVisibleText, controlContrast, installAuditFixture, type AuditMode } from './support/fe8-audit';

type Screen = { name: string; path: string; anonymous?: boolean; mentor?: boolean; linkedStats?: boolean; attachments?: boolean; programState?: 'apply' | 'closed' | 'applied'; fixtureMode?: AuditMode; action?: (page: Page, theme: 'light' | 'dark') => Promise<void> };
const click = (name: string) => async (page: Page) => { await page.getByRole('button', { name, exact: true }).click(); };
async function checkHover(control: Locator, theme: 'light' | 'dark', lightBackground: number[]) {
  await control.hover();
  // Measure the settled hover color, not the beginning of a CSS transition.
  await control.page().waitForTimeout(250);
  if (theme === 'dark') {
    await expect.poll(async () => (await controlContrast(control)).ratio).toBeGreaterThanOrEqual(4.5);
    await expect.poll(async () => (await controlContrast(control)).background.every(value => value < 100)).toBe(true);
  } else {
    await expect.poll(async () => (await controlContrast(control)).background).toEqual(lightBackground);
  }
}
const screens: Screen[] = [
  { name: 'composer-suggestions-hover', path: '/home', action: async (page, theme) => { await page.getByPlaceholder('무슨 생각을 하고 있나요?').fill('#게'); await checkHover(page.getByRole('button', { name: /#게임.*게시물 1개/ }), theme, [250, 250, 250]); } },
  { name: 'profile-follower-row-hover', path: '/profile/viewer', action: async (page, theme) => { await page.getByRole('button', { name: /팔로워/ }).first().click(); await expect(page.getByRole('heading', { name: '팔로워', exact: true })).toBeVisible(); await checkHover(page.getByRole('link', { name: /대화상대/ }).locator('..'), theme, [250, 250, 250]); } },
  { name: 'profile-disconnect-cancel-hover', path: '/profile/viewer', linkedStats: true, action: async (page, theme) => { await click('전적')(page); await click('PUBG 전적 연동 해제')(page); await expect(page.getByRole('heading', { name: 'PUBG 전적 연동을 해제할까요?' })).toBeVisible(); await checkHover(page.getByRole('button', { name: '취소', exact: true }), theme, [244, 244, 245]); } },
  { name: 'messages-attachment-trigger-hover', path: '/messages', action: async (page, theme) => { await page.getByRole('button', { name: /대화상대/ }).click(); await checkHover(page.getByRole('button', { name: '첨부 메뉴', exact: true }), theme, [228, 228, 231]); } },
  { name: 'home', path: '/home' },
  { name: 'home-load-more-error', path: '/home', action: async page => { let firstRequests = 0, nextRequests = 0; await page.route('**/api/v1/feed?*', route => { if (new URL(route.request().url()).searchParams.has('cursor')) { nextRequests++; return route.fulfill({ status: 500, json: { success: false, message: '추가 페이지 조회 실패' } }); } firstRequests++; return route.fulfill({ json: { success: true, data: { items: [auditPost], nextCursor: 'next-page', hasNext: true } } }); }); await page.reload(); await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await expect(page.locator('main [role="alert"] > span').filter({ hasText: '추가 페이지 조회 실패' })).toBeVisible(); expect(firstRequests).toBe(1); expect(nextRequests).toBe(1); } },
  { name: 'search-overview', path: '/search?q=게임' },
  ...['accounts', 'posts', 'hashtags'].map(tab => ({ name: `search-${tab}`, path: `/search?q=게임&tab=${tab}` })),
  { name: 'bookmarks', path: '/bookmarks' },
  { name: 'hashtag', path: '/hashtags/게임' },
  { name: 'post-detail', path: '/posts/post-1' },
  { name: 'profile-posts', path: '/profile/viewer' },
  { name: 'profile-report-hover', path: '/profile/recipient', action: async (page, theme) => { await click('사용자 메뉴')(page); await checkHover(page.getByRole('button', { name: '사용자 신고', exact: true }), theme, [254, 242, 242]); } },
  { name: 'profile-cancel-hover', path: '/profile/recipient', action: async (page, theme) => { await click('사용자 메뉴')(page); await checkHover(page.getByRole('button', { name: '취소', exact: true }), theme, [250, 250, 250]); } },
  { name: 'profile-stats', path: '/profile/viewer', action: click('전적') },
  { name: 'profile-media', path: '/profile/viewer', action: click('미디어') },
  { name: 'settings-account', path: '/settings' },
  { name: 'settings-theme', path: '/settings', action: click('테마') },
  { name: 'settings-tab-hover', path: '/settings', action: async (page, theme) => { const tab = page.getByRole('button', { name: '테마', exact: true }); await expect(tab).not.toHaveAttribute('aria-current', 'page'); await checkHover(tab, theme, [244, 244, 245]); } },
  { name: 'messages-list', path: '/messages' },
  { name: 'messages-card-hover', path: '/messages', action: async (page, theme) => { await checkHover(page.getByRole('button', { name: /대화상대/ }), theme, [250, 250, 250]); } },
  { name: 'messages-leave-hover', path: '/messages', action: async (page, theme) => { await page.getByRole('button', { name: /대화상대/ }).click(); await click('대화방 옵션')(page); await checkHover(page.getByRole('button', { name: '대화방 나가기', exact: true }), theme, [254, 242, 242]); } },
  { name: 'messages-delete-hover', path: '/messages', action: async (page, theme) => { await page.getByRole('button', { name: /대화상대/ }).click(); await click('메시지 액션')(page); await checkHover(page.getByRole('button', { name: '메시지 삭제', exact: true }), theme, [254, 242, 242]); } },
  { name: 'messages-chat', path: '/messages', action: async page => { await page.getByRole('button', { name: /대화상대/ }).click(); } },
  ...(['사진 추가', '동영상 추가', '첨부 지우기'] as const).map((name, index) => ({ name: `messages-attachment-menu-hover-${index}`, path: '/messages', action: async (page: Page, theme: 'light' | 'dark') => { await page.getByRole('button', { name: /대화상대/ }).click(); await click('첨부 메뉴')(page); await checkHover(page.getByRole('button', { name, exact: true }), theme, [250, 250, 250]); } })),
  { name: 'messages-attachments', path: '/messages', attachments: true, action: async page => { await page.getByRole('button', { name: /대화상대/ }).click(); for (const name of ['받은 이미지.png', '보낸 이미지.png', '받은 영상.webm', '보낸 영상.webm']) await expect(page.getByText(name, { exact: true })).toBeAttached(); } },
  { name: 'messages-send-error', path: '/messages', action: async page => { let requests = 0; await page.route('**/api/v1/messages/conversations/conversation-1/messages**', route => { if (route.request().method() !== 'POST') return route.fallback(); requests++; return route.fulfill({ status: 500, json: { success: false, message: '메시지 전송 실패' } }); }); await page.getByRole('button', { name: /대화상대/ }).click(); const input = page.getByPlaceholder('대화상대님에게 메시지 보내기'); await input.fill('실패한 메시지'); await click('메시지 전송')(page); await expect(page.locator('form').getByText('메시지 전송 실패', { exact: true })).toBeVisible(); await expect(input).toHaveValue('실패한 메시지'); expect(requests).toBe(1); } },
  { name: 'mentoring-find', path: '/mentoring' },
  { name: 'mentoring-detail', path: '/mentoring', action: async page => { await page.getByRole('button', { name: /랭크 게임 코칭/ }).first().click(); await expect(page.getByRole('heading', { name: '랭크 게임 코칭', level: 2 })).toBeVisible(); } },
  { name: 'mentoring-mine', path: '/mentoring?tab=mine' },
  { name: 'mentoring-programs', path: '/mentoring', action: click('내 프로그램') },
  { name: 'mentoring-register', path: '/mentoring', action: click('멘토 되기') },
  { name: 'mentoring-first-registration', path: '/mentoring', mentor: false, action: async page => { await click('멘토 되기')(page); await click('멘토 등록하기')(page); } },
  { name: 'mentoring-own-detail', path: '/mentoring', action: async page => { await click('내 프로그램')(page); await page.getByRole('button', { name: /랭크 게임 코칭/ }).first().click(); await expect(page.getByRole('heading', { name: '멘티 리뷰' })).toBeVisible(); } },
  { name: 'mentoring-review', path: '/mentoring?tab=mine', action: async page => { await click('리뷰 작성')(page); await expect(page.getByRole('heading', { name: '리뷰 작성' })).toBeVisible(); } },
  { name: 'login', path: '/login', anonymous: true },
  { name: 'login-form', path: '/login', anonymous: true, action: click('ID로 로그인') },
  { name: 'signup-step1', path: '/login', anonymous: true, action: click('회원가입') },
  { name: 'signup-step2', path: '/login', anonymous: true, action: async page => { await page.getByRole('button', { name: '회원가입', exact: true }).click(); await page.locator('input[name=nickname]').fill('테스터'); await page.locator('input[name=email]').fill('viewer@example.com'); await page.getByRole('button', { name: '다음', exact: true }).click(); } },
  { name: 'find-id', path: '/find-id', anonymous: true },
  { name: 'find-id-result', path: '/find-id-result?maskedHandle=vi***&createdAt=2026-10-01', anonymous: true },
  { name: 'forgot-password', path: '/auth/forgot-password', anonymous: true },
  { name: 'reset-password', path: '/auth/reset-password?token=fixture', anonymous: true },
  { name: 'reset-no-token', path: '/auth/reset-password', anonymous: true },
  { name: 'social-signup', path: '/auth/social/complete#signupToken=fixture', anonymous: true },
  { name: 'oauth-loading', path: '/auth/oauth-success', anonymous: true, fixtureMode: 'loading' },
  { name: 'oauth-error', path: '/auth/oauth-success', anonymous: true },
  { name: 'login-error', path: '/login', anonymous: true, action: async page => { await click('ID로 로그인')(page); await page.locator('input[name=username]').fill('viewer'); await page.locator('input[name=password]').fill('Password1!'); await click('로그인')(page); await expect(page.getByText('요청을 처리하지 못했습니다. 다시 시도해주세요.', { exact: true })).toBeVisible(); } },
  { name: 'login-loading', path: '/login', anonymous: true, fixtureMode: 'loading', action: async page => { await click('ID로 로그인')(page); await page.locator('input[name=username]').fill('viewer'); await page.locator('input[name=password]').fill('Password1!'); await click('로그인')(page); await expect(page.getByRole('button', { name: '로그인 중...' })).toBeVisible(); } },
  { name: 'find-id-error', path: '/find-id', anonymous: true, action: async page => { await page.getByPlaceholder('이메일 입력').fill('viewer@example.com'); await click('아이디 찾기')(page); await expect(page.getByText('일치하는 정보가 없습니다. 다시 확인해 주세요.')).toBeVisible(); } },
  { name: 'forgot-password-error', path: '/auth/forgot-password', anonymous: true, action: async page => { await page.getByPlaceholder('아이디 입력').fill('viewer'); await click('비밀번호 재설정 메일 받기')(page); await expect(page.getByText('요청을 처리하지 못했습니다. 다시 시도해주세요.', { exact: true })).toBeVisible(); } },
  { name: 'forgot-password-loading', path: '/auth/forgot-password', anonymous: true, fixtureMode: 'loading', action: async page => { await page.getByPlaceholder('아이디 입력').fill('viewer'); await click('비밀번호 재설정 메일 받기')(page); await expect(page.getByRole('button', { name: '전송 중...' })).toBeVisible(); } },
  { name: 'social-error', path: '/auth/social/complete', anonymous: true, action: async page => { await click('회원가입 완료')(page); await expect(page.getByText('소셜 회원가입 토큰이 없습니다. 다시 로그인해주세요.')).toBeVisible(); } },
  { name: 'post-menu-hover', path: '/home', action: async page => { await click('게시물 메뉴')(page); await page.getByRole('button', { name: '게시물 신고', exact: true }).hover(); } },
  { name: 'post-detail-menu-hover', path: '/posts/post-1', action: async page => { await click('게시물 메뉴')(page); await page.getByRole('button', { name: '게시물 신고', exact: true }).hover(); } },
  { name: 'post-menu-cancel-hover', path: '/home', action: async page => { await click('게시물 메뉴')(page); await page.getByRole('button', { name: '취소', exact: true }).hover(); } },
  { name: 'notifications-open', path: '/home', action: click('알림') },
  { name: 'messages-new', path: '/messages', action: click('새 대화 시작') },
  { name: 'signup-invalid', path: '/login', anonymous: true, action: async page => { await click('회원가입')(page); await page.locator('input[name="nickname"]').fill('A'); await page.locator('input[name="email"]').fill('bad'); } },
  { name: 'signup-password-match', path: '/login', anonymous: true, action: async page => { await click('회원가입')(page); await page.locator('input[name="nickname"]').fill('테스터'); await page.locator('input[name="email"]').fill('viewer@example.com'); await click('다음')(page); await page.locator('input[name="username"]').fill('viewer'); await page.locator('input[name="new-password"]').fill('Password1!'); await page.locator('input[name="new-password-confirm"]').fill('Password1!'); } },
  { name: 'forgot-password-success', path: '/auth/forgot-password', anonymous: true, action: async page => { await page.route('**/api/v1/auth/find-password', route => route.fulfill({ json: { success: true, data: null } })); await page.getByPlaceholder('아이디 입력').fill('viewer'); await click('비밀번호 재설정 메일 받기')(page); await expect(page.getByRole('heading', { name: '메일을 확인해 주세요' })).toBeVisible(); } },
  { name: 'reset-invalid', path: '/auth/reset-password?token=fixture', anonymous: true, action: async page => { await page.getByPlaceholder('새 비밀번호', { exact: true }).fill('short'); } },
  { name: 'login-focus', path: '/login', anonymous: true, action: async page => { await click('ID로 로그인')(page); await page.locator('input[name="username"]').focus(); } },
  { name: 'modal-edit-profile', path: '/profile/viewer', action: click('프로필 수정') },
  { name: 'modal-game-stats', path: '/profile/viewer', action: async page => { await click('전적')(page); await click('전적 추가')(page); } },
  { name: 'modal-share', path: '/posts/post-1', action: async page => { await click('게시물 공유')(page); await page.getByRole('button', { name: /대화상대/ }).click(); } },
  { name: 'modal-report', path: '/posts/post-1', action: async page => { await click('게시물 메뉴')(page); await click('게시물 신고')(page); await click('스팸')(page); } },
  { name: 'modal-report-error', path: '/posts/post-1', action: async page => { await page.route('**/api/v1/reports', route => route.fulfill({ status: 500, json: { success: false, message: '신고 접수 실패 테스트' } })); await click('게시물 메뉴')(page); await click('게시물 신고')(page); await click('스팸')(page); await click('신고 접수')(page); await page.getByRole('dialog', { name: '신고하시겠습니까?' }).getByRole('button', { name: '신고 접수', exact: true }).click(); await expect(page.getByText('신고 접수 실패 테스트', { exact: true }).first()).toBeVisible(); } },
  { name: 'modal-collection', path: '/posts/post-1', action: async page => { await page.route('**/api/v1/posts/post-1', route => route.fulfill({ json: { success: true, data: { ...auditPost, bookmarkedByMe: false } } })); await page.reload(); await click('북마크 저장')(page); await click('새 모음집 만들기')(page); } },
  { name: 'toast-error', path: '/settings', action: async page => { await click('비밀번호 변경')(page); await expect(page.getByRole('alert').filter({ hasText: '비밀번호 입력칸을 모두 채워주세요' })).toBeVisible(); await page.mouse.move(0, 0); } },
  { name: 'modal-confirm', path: '/posts/post-1', action: async page => { await page.route('**/api/v1/posts/post-1', route => route.fulfill({ json: { success: true, data: { ...auditPost, mine: true, authorHandle: 'viewer' } } })); await page.reload(); await click('게시물 메뉴')(page); await click('삭제')(page); await expect(page.getByRole('alertdialog')).toBeVisible(); } },
  { name: 'profile-linked-stats', path: '/profile/viewer', linkedStats: true, action: click('전적') },
  { name: 'profile-followers', path: '/profile/viewer', action: async page => { await page.getByRole('button', { name: /팔로워/ }).first().click(); await expect(page.getByRole('heading', { name: '팔로워', exact: true })).toBeVisible(); } },
  { name: 'profile-follow-error', path: '/profile/viewer', action: async page => { await page.route('**/api/v1/users/viewer/followers?*', route => route.fulfill({ status: 500, json: { success: false, message: '팔로워를 조회하지 못했습니다.' } })); await page.getByRole('button', { name: /팔로워/ }).first().click(); await expect(page.getByText('팔로워를 조회하지 못했습니다.')).toBeVisible(); } },
  { name: 'messages-recipient-error', path: '/messages', action: async page => { await page.route('**/api/v1/messages/recipients?*', route => route.fulfill({ status: 500, json: { success: false, message: '사용자를 검색하지 못했습니다.' } })); await click('새 대화 시작')(page); await expect(page.getByText('사용자를 검색하지 못했습니다.')).toBeVisible(); } },
  ...(['apply', 'closed', 'applied'] as const).map(programState => ({ name: `mentoring-${programState}`, path: '/mentoring', programState, action: async (page: Page) => { if (programState === 'applied') { await click('내 멘토링')(page); await expect(page.getByRole('button', { name: '리뷰 작성', exact: true })).toBeVisible(); await click('멘토 찾기')(page); } await page.getByRole('button', { name: /랭크 게임 코칭/ }).first().click(); await expect(page.getByRole('heading', { name: '랭크 게임 코칭', level: 2 })).toBeVisible(); } })),
];
const stateScreens = screens.filter(row => ['home', 'search-overview', 'bookmarks', 'hashtag', 'post-detail', 'profile-posts', 'messages-list', 'mentoring-find', 'mentoring-mine'].includes(row.name));
const iconHoverScreens = new Set(['home', 'post-detail', 'messages-chat', 'messages-new', 'profile-followers', 'profile-linked-stats', 'modal-edit-profile', 'modal-share', 'modal-report', 'modal-report-error', 'signup-step1']);
async function checkIconHovers(page: Page, theme: 'light' | 'dark') {
  const colors: Record<string, number[]> = { white: [255, 255, 255], 'zinc-50': [250, 250, 250], 'zinc-100': [244, 244, 245], 'zinc-200': [228, 228, 231], 'red-50': [254, 242, 242] };
  for (const button of await page.getByRole('button').all()) {
    if (!await button.isVisible() || !await button.isEnabled() || (await button.textContent())?.trim()) continue;
    // Modal-covered buttons are visible in the DOM but cannot be hovered by a user.
    const exposed = await button.evaluate(el => { const rect = el.getBoundingClientRect(); const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2); return !!top && el.contains(top); });
    if (!exposed) continue;
    const classes = (await button.getAttribute('class')) ?? '';
    if (!/dark:hover:bg-(neutral-800|red-950\/40)/.test(classes)) continue;
    const color = classes.match(/(?:^|\s)hover:bg-(white|zinc-50|zinc-100|zinc-200|red-50)(?:\s|$)/)?.[1];
    if (color) await checkHover(button, theme, colors[color]);
  }
}

for (const width of [390, 1440]) for (const theme of ['light', 'dark'] as const) {
  test.describe(`${width}px ${theme} full audit`, () => {
    test.use({ viewport: { width, height: 900 }, colorScheme: theme, timezoneId: 'Asia/Seoul' });
    for (const mode of ['ready', 'empty', 'error', 'loading'] as AuditMode[]) for (const screen of mode === 'ready' ? screens : stateScreens) {
      test(`${mode} ${screen.name}`, async ({ page }, info) => {
        const pageErrors: string[] = [];
        page.on('pageerror', error => pageErrors.push(error.message));
        const fixture = await installAuditFixture(page, theme, { mode: screen.fixtureMode ?? mode, anonymous: screen.anonymous, mentor: screen.mentor, linkedStats: screen.linkedStats, attachments: screen.attachments, programState: screen.programState });
        try {
          await page.goto(screen.path);
          await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
          if (screen.action) await screen.action(page, theme);
          if (mode === 'error') await expect(page.getByText('조회하지 못했습니다. 다시 시도해주세요.', { exact: true }).first()).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(600);
          if (mode === 'ready' && iconHoverScreens.has(screen.name)) await checkIconHovers(page, theme);
          await expect(page.locator('body')).not.toHaveText('');
          const audits = [];
          const height = await page.evaluate(() => document.documentElement.scrollHeight);
          for (let y = 0; y < height; y += 700) {
            await page.evaluate(y => scrollTo(0, y), y);
            audits.push(await auditVisibleText(page));
          }
          // Overflowing modal bodies are audited beyond the initial viewport too.
          const scrolls = page.locator('div').filter({ visible: true });
          for (const node of await scrolls.all()) {
            if (await node.evaluate(el => el.scrollHeight > el.clientHeight + 10 && /auto|scroll/.test(getComputedStyle(el).overflowY))) {
              const max = await node.evaluate(el => el.scrollHeight);
              await node.evaluate(el => { el.scrollTop = 0; });
              audits.push(await auditVisibleText(page));
              for (let y = 700; y < max; y += 700) { await node.evaluate((el, y) => { el.scrollTop = y; }, y); audits.push(await auditVisibleText(page)); }
              await node.evaluate(el => { el.scrollTop = 0; });
            }
          }
          await page.evaluate(() => scrollTo(0, 0));
          const auditPath = info.outputPath('contrast-audit.json');
          writeFileSync(auditPath, JSON.stringify(audits));
          await info.attach('contrast-audit', { path: auditPath, contentType: 'application/json' });
          const screenshot = info.outputPath('screen.png');
          await page.screenshot({ path: screenshot, fullPage: true });
          await info.attach('screen', { path: screenshot, contentType: 'image/png' });
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
          expect(pageErrors, 'unhandled browser errors').toEqual([]);
          if (theme === 'dark' && !process.env.FE8_RECORD_ONLY) {
            expect(audits.flatMap(audit => audit.rows.filter(row => row.image)), 'unmeasured image-backed text').toEqual([]);
            expect(audits.flatMap(audit => audit.rows.filter(row => !row.image && row.ratio < row.required)), 'visible text contrast').toEqual([]);
            // FE-10 deliberately uses a white-on-dark recovery control, not a leaking panel.
            expect(audits.flatMap(audit => audit.white.filter(row => !row.intentional)), 'unexpected bright surface').toEqual([]);
          }
        } finally { fixture.release(); }
      });
    }
  });
}
