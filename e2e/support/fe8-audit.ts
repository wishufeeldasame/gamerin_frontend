import type { Locator, Page } from '@playwright/test';

export type AuditMode = 'ready' | 'empty' | 'error' | 'loading';
export const auditUser = { userId: 'viewer', handle: 'viewer', nickname: '테스터', role: 'USER', status: 'ACTIVE' };
const date = '2026-10-09T06:00:00Z';
const cursor = { items: [], nextCursor: null, hasNext: false };
const pageOf = (content: unknown[]) => ({ content, number: 0, size: 10, totalPages: content.length ? 1 : 0, totalElements: content.length, first: true, last: true, empty: !content.length });
export const auditPost = {
  postId: 'post-1', author: '작성자', authorHandle: 'author', authorProfileImageUrl: null, authorVerifiedBadge: false,
  content: '화면 대비 점검 @viewer #게임', game: null, media: [], likes: 2, comments: 1, shares: 0,
  repostCount: 0, isReposted: false, likedByMe: false, bookmarkedByMe: true, mine: false, createdAt: date,
};
export const auditProgram = {
  id: 'program-1', mentorId: 'viewer', mentorNickname: '테스터', gameName: 'LOL', title: '랭크 게임 코칭',
  content: '[진행 방식]\n온라인 코칭\n\n[상세 설명]\n기본기와 운영을 알려드립니다.', availableTimeDesc: '주말 오후',
  status: 'ACTIVE', price: 10000, tags: ['기본기'], createdAt: date,
};
const mentor = { userId: 'viewer', nickname: '테스터', status: 'ACTIVE', about: '게임 코칭 멘토입니다.', ratingAvg: 4.5, reviewCount: 1, menteeCount: 2 };
const profile = { id: 'viewer', handle: 'viewer', nickname: '테스터', bio: '게임 이야기를 나눠요.', location: '서울', website: 'https://example.com', coverImageUrl: null, profileImageUrl: null, gameStats: {}, verifiedBadge: false, followersCount: 2, followingCount: 1, postCount: 1, mediaPostCount: 0, mediaItemCount: 0 };
const recipient = { id: 'recipient', name: '대화상대', handle: '@recipient', role: 'USER', online: false };
const chat = ['받은 메시지', '보낸 메시지'].map((text, i) => ({ id: `message-${i}`, senderId: i ? 'me' : 'recipient', text, createdAt: date, read: true, deliveryStatus: 'sent', attachments: [], sharedPost: null }));
const application = { id: 'application-1', programId: 'program-1', programTitle: auditProgram.title, mentorId: 'viewer', mentorNickname: '테스터', menteeId: 'recipient', menteeNickname: '멘티', appliedMileage: 10000, status: 'COMPLETED', paymentStatus: 'SETTLED', message: '운영을 배우고 싶어요.', createdAt: date, reviewed: false };
const applications = ['APPLIED', 'ACCEPTED', 'ONGOING', 'FINISHED', 'COMPLETED', 'REJECTED', 'CANCELLED'].map((status, i) => ({ ...application, id: `application-${i}`, status, paymentStatus: status === 'COMPLETED' ? 'SETTLED' : ['REJECTED', 'CANCELLED'].includes(status) ? 'REFUNDED' : 'ESCROW_HELD' }));

export async function installAuditFixture(page: Page, theme: 'light' | 'dark', options: { mode?: AuditMode; anonymous?: boolean; mentor?: boolean; linkedStats?: boolean; attachments?: boolean; programState?: 'apply' | 'closed' | 'applied' } = {}) {
  const mode = options.mode ?? 'ready';
  const shownProgram = options.programState ? { ...auditProgram, mentorId: 'recipient', mentorNickname: '멘토', status: options.programState === 'closed' ? 'CLOSED' : 'ACTIVE' } : auditProgram;
  const shownProfile = options.linkedStats ? { ...profile, gameStats: { PUBG: { connected: true, playerName: 'Player', statsMode: 'RANKED', tierLabel: 'GOLD', winRate: 50, kd: 2, matches: 20 } } } : profile;
  const shownChat = options.attachments ? (['image', 'video'] as const).flatMap(type => chat.map((message, index) => ({ ...message, id: `${message.id}-${type}`, attachments: [{ id: `${type}-${index}`, type, name: `${index ? '보낸' : '받은'} ${type === 'image' ? '이미지.png' : '영상.webm'}`, url: `/api/v1/messages/attachments/review-${type}` }] }))) : chat;
  await page.addInitScript(({ theme, anonymous, user }) => {
    localStorage.setItem('gamerin_user_settings', JSON.stringify({ theme }));
    if (!anonymous) localStorage.setItem('gamerin_user', JSON.stringify({ id: user.userId, name: user.nickname, nickname: user.nickname, handle: user.handle, role: user.role, status: user.status, gameTier: 'Unranked' }));
  }, { theme, anonymous: !!options.anonymous, user: auditUser });
  const parked = new Set<() => void>();
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname;
    const publicAuth = path.startsWith('/api/v1/auth/');
    if (path.endsWith('/attachments/review-image')) { await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="90"><rect width="180" height="90" fill="#333333"/></svg>' }); return; }
    // This scenario checks the video's filename strip, not media playback.
    if (path.endsWith('/attachments/review-video')) { await route.fulfill({ contentType: 'video/webm', body: Buffer.alloc(0) }); return; }
    if (options.anonymous && publicAuth) {
      if (mode === 'loading') { await new Promise<void>(resolve => parked.add(resolve)); }
      await route.fulfill({ status: 400, json: { success: false, message: '요청을 처리하지 못했습니다. 다시 시도해주세요.' } }).catch(() => {}); return;
    }
    // Keep SSE pending while measuring the initial failure: its onopen clears pageError.
    if (mode === 'error' && path.endsWith('/stream')) await new Promise<void>(resolve => parked.add(resolve));
    if (!publicAuth && !path.includes('/stream') && mode === 'loading') await new Promise<void>(resolve => parked.add(resolve));
    if (!publicAuth && !path.includes('/stream') && mode === 'error') {
      await route.fulfill({ status: 500, json: { success: false, message: '조회하지 못했습니다. 다시 시도해주세요.' } }); return;
    }
    const empty = mode === 'empty';
    const posts = empty ? [] : [auditPost];
    let data: unknown = null;
    if (path.endsWith('/auth/refresh')) data = { userId: auditUser.userId, accessToken: 'fe8-audit-test-token' };
    else if (path.endsWith('/auth/me')) data = auditUser;
    else if (path === '/api/v1/feed' || path.endsWith('/bookmarks') || /\/hashtags\/[^/]+\/posts$/.test(path)) data = { ...cursor, items: posts };
    else if (path === '/api/v1/posts/post-1') data = auditPost;
    else if (path.endsWith('/post-1/comments')) data = empty ? [] : [{ commentId: 'comment-1', author: '댓글 작성자', authorHandle: 'commenter', content: '댓글 내용', createdAt: date, mine: false }];
    else if (path === '/api/v1/users/me' || path === '/api/v1/users/viewer') data = shownProfile;
    else if (path === '/api/v1/users/recipient') data = { ...profile, id: 'recipient', handle: 'recipient', nickname: '대화상대' };
    else if (/\/users\/recipient\/(posts|media)$/.test(path)) data = cursor;
    else if (/\/users\/viewer\/(posts|media)$/.test(path)) data = { ...cursor, items: path.endsWith('/media') ? [] : posts };
    else if (/\/users\/viewer\/(followers|following)$/.test(path)) data = { ...cursor, items: empty ? [] : [{ userId: 'recipient', handle: 'recipient', nickname: '대화상대', profileImageUrl: null, verifiedBadge: false, followedAt: date, followedByMe: false, followsViewer: true }] };
    else if (path.endsWith('/bookmark-collections')) data = empty ? [] : [{ collectionId: 'collection-1', name: '게임 모음', bookmarkCount: 1 }];
    else if (path.includes('/bookmark-collections/')) data = [];
    else if (path.endsWith('/notifications/unread-count')) data = { unreadCount: empty ? 0 : 1 };
    else if (path.endsWith('/notifications')) data = { ...cursor, items: empty ? [] : [{ notificationId: 'notification-1', type: 'like', actor: { ...auditUser, verifiedBadge: false, profileImageUrl: null }, postId: 'post-1', read: false, createdAt: date }] };
    else if (path.endsWith('/messages/conversations')) data = empty ? [] : [{ id: 'conversation-1', recipient, messages: shownChat, unreadCount: 0, updatedAt: date }];
    else if (path.endsWith('/conversation-1/messages')) data = { ...cursor, items: empty ? [] : shownChat };
    else if (path.endsWith('/recipients')) data = empty ? [] : [recipient];
    else if (path.endsWith('/stream')) { await route.fulfill({ contentType: 'text/event-stream', body: ': keepalive\n\n' }); return; }
    else if (path.endsWith('/stream-token')) data = { expiresAt: '2099-01-01T00:00:00Z' };
    else if (path === '/api/v1/search') data = { query: '게임', accounts: { items: empty ? [] : [{ ...profile, verifiedBadge: false }], hasMore: false }, posts: { items: posts, hasMore: false }, hashtags: { items: empty ? [] : [{ hashtagId: 'tag-1', name: '게임', postCount: 1 }], hasMore: false } };
    else if (path.endsWith('/search/accounts')) data = { ...cursor, items: empty ? [] : [profile] };
    else if (path.endsWith('/search/posts')) data = { ...cursor, items: posts };
    else if (path.endsWith('/search/hashtags') || path === '/api/v1/hashtags') data = empty ? [] : [{ hashtagId: 'tag-1', name: '게임', postCount: 1 }];
    else if (path === '/api/v1/games') data = [{ code: 'LOL', name: 'League of Legends' }, { code: 'PUBG', name: 'PUBG' }];
    else if (path.endsWith('/mentors/me')) data = options.mentor === false || empty ? null : mentor;
    else if (path.endsWith('/mentors/viewer')) data = mentor;
    else if (path.endsWith('/mentors/recipient')) data = { ...mentor, userId: 'recipient', nickname: '멘토' };
    else if (path.endsWith('/programs')) data = pageOf(empty ? [] : [shownProgram]);
    else if (path.endsWith('/programs/program-1')) data = { ...shownProgram, mentorAbout: mentor.about };
    else if (path.endsWith('/applications/mentee')) data = pageOf(empty || options.programState === 'apply' || options.programState === 'closed' ? [] : applications.map(value => ({ ...value, id: 'my-' + value.id, mentorId: 'recipient', mentorNickname: '멘토', menteeId: 'viewer' })));
    else if (path.endsWith('/applications/mentor')) data = pageOf(empty ? [] : applications);
    else if (path.endsWith('/reviews')) data = pageOf(empty ? [] : [{ id: 'review-1', applicationId: application.id, programId: auditProgram.id, programTitle: auditProgram.title, menteeNickname: '멘티', rating: 4.5, content: '알기 쉬운 코칭이었습니다.', createdAt: date }]);
    else if (path.endsWith('/balance')) data = { currentBalance: 50000 };
    else if (path.endsWith('/transactions')) data = pageOf(empty ? [] : [{ id: 'transaction-1', amount: 10000, balanceAfter: 50000, type: 'CHARGE', typeDescription: '충전', description: '마일리지 충전', createdAt: date }]);
    else if (path.endsWith('/reports/my')) data = pageOf([]);
    else if (path.endsWith('/reports/reasons')) data = [{ code: 'SPAM', label: '스팸' }, { code: 'OTHER', label: '기타' }];
    await route.fulfill({ json: { success: true, data } }).catch(() => {});
  });
  return { release: () => { parked.forEach(resolve => resolve()); parked.clear(); } };
}

export async function auditVisibleText(page: Page) {
  return page.evaluate(() => {
    const rgba = (color: string) => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; const c = canvas.getContext('2d')!; c.fillStyle = color; c.fillRect(0, 0, 1, 1); return Array.from(c.getImageData(0, 0, 1, 1).data); };
    const over = (f: number[], b: number[]) => [0, 1, 2].map(i => f[i] * f[3] / 255 + b[i] * (1 - f[3] / 255)).concat(255);
    const lum = (c: number[]) => c.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const rows: { text: string; ratio: number; required: number; color: string; background: number[]; image: boolean; className: string; tag: string; opacity: number }[] = [];
    const white: { tag: string; text: string; className: string; color: string; intentional: boolean }[] = [];
    for (const element of document.querySelectorAll<HTMLElement>('body *')) {
      if (['SCRIPT', 'STYLE', 'SVG', 'PATH', 'OPTION', 'IMG', 'VIDEO', 'CANVAS'].includes(element.tagName)) continue;
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      if (!rect.width || !rect.height || rect.bottom < 0 || rect.top >= innerHeight || rect.right < 0 || rect.left >= innerWidth || style.visibility === 'hidden') continue;
      const cx = Math.max(0, Math.min(innerWidth - 1, rect.x + rect.width / 2)), cy = Math.max(0, Math.min(innerHeight - 1, rect.y + rect.height / 2));
      const onTop = document.elementFromPoint(cx, cy);
      if (onTop && onTop !== element && !element.contains(onTop) && !onTop.contains(element)) continue;
      let opacity = 1, image = false;
      const chain: number[][] = [];
      for (let node: Element | null = element; node; node = node.parentElement) { const s = getComputedStyle(node); opacity *= Number(s.opacity); chain.unshift(rgba(s.backgroundColor)); image ||= s.backgroundImage !== 'none'; }
      if (opacity < .01) continue;
      let background = [255, 255, 255, 255]; for (const color of chain) background = over(color, background);
      const own = rgba(style.backgroundColor);
      // Check the composited surface too: bg-white/80 must not escape detection.
      const brightSurface = own[3] >= 128 && own.slice(0, 3).every(v => v > 220) && background.slice(0, 3).every(v => v > 190) && Math.max(...background.slice(0, 3)) - Math.min(...background.slice(0, 3)) < 35;
      if (brightSurface && rect.width > 50 && rect.height > 25) white.push({ tag: element.tagName, text: element.textContent?.trim().slice(0, 70) ?? '', className: element.className, color: style.backgroundColor, intentional: ['A', 'BUTTON'].includes(element.tagName) && element.classList.contains('dark:bg-white') });
      // Disabled controls are text-contrast exempt, not bright-surface exempt.
      if (element.closest('button:disabled,input:disabled,select:disabled,textarea:disabled,[aria-disabled=true]')) continue;
      const direct = Array.from(element.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent?.trim()).join(' ').trim();
      const isInput = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
      const content = isInput ? element.value || element.placeholder : element instanceof HTMLSelectElement ? element.selectedOptions[0]?.text : direct;
      if (!content) continue;
      const placeholder = isInput && !element.value;
      const fgStyle = getComputedStyle(element, placeholder ? '::placeholder' : null), raw = rgba(fgStyle.color); raw[3] *= opacity;
      const foreground = over(raw, background), a = lum(foreground), b = lum(background);
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.6667 && Number(style.fontWeight) >= 700);
      rows.push({ text: content.slice(0, 100), ratio: Number(((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toFixed(3)), required: large ? 3 : 4.5, color: fgStyle.color, background: background.slice(0, 3), image, className: element.className, tag: element.tagName, opacity });
    }
    return { rows, white, dark: document.documentElement.classList.contains('dark') };
  });
}

// Icon-only controls have no text node; measure their actual inherited foreground too.
export async function controlContrast(control: Locator) {
  return control.evaluate(element => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    const rgba = (color: string) => { context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1); return Array.from(context.getImageData(0, 0, 1, 1).data); };
    const over = (front: number[], back: number[]) => [0, 1, 2].map(i => front[i] * front[3] / 255 + back[i] * (1 - front[3] / 255)).concat(255);
    const luminance = (color: number[]) => color.slice(0, 3).map(value => { value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    const layers: number[][] = [];
    for (let node: Element | null = element; node; node = node.parentElement) layers.unshift(rgba(getComputedStyle(node).backgroundColor));
    let background = [255, 255, 255, 255];
    for (const layer of layers) background = over(layer, background);
    const style = getComputedStyle(element), foreground = over(rgba(style.color), background);
    const first = luminance(foreground), second = luminance(background);
    return { ratio: (Math.max(first, second) + .05) / (Math.min(first, second) + .05), color: style.color, background: background.slice(0, 3) };
  });
}
