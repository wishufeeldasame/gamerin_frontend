// 임시 파일: 디자인 시스템 v2 적용 완료 후 이 파일과 package.json 의 `dev:mock` 스크립트를 삭제한다.
//
// 실제 백엔드 없이 로그인 이후 화면을 `npm run dev` 로 보기 위한 목 API 서버(의존성 없음, node: 내장 모듈만 사용).
// 경로·응답 모양의 기준은 e2e/support/fe8-audit.ts 의 ready 모드 표이고, 보기 좋게 데이터를 늘리고 로그인·멤버십 등을 보탰다.
//
// 주의: 실제 백엔드가 8080 을 쓰고 있으면 실행하지 않는다(포트 충돌). 다른 포트는 PORT 환경변수로 지정하되,
//       프론트는 localhost:3000 일 때 8080 만 호출하므로 NEXT_PUBLIC_API_BASE_URL 도 함께 맞춰야 한다.
// 사용법:
//   1) 터미널 A: npm run dev:mock            (기본 포트 8080)
//   2) 터미널 B: npm run dev                 (http://localhost:3000, NEXT_PUBLIC_API_BASE_URL 은 비워 둔다)
//   3) 로그인 화면에서 테스트 계정 아이디 `tester` / 비밀번호 `test1234`
//      (이미 localStorage 에 gamerin_user 가 있으면 /auth/refresh·/auth/me 가 항상 성공해 세션이 복원된다)
// 상태는 메모리에 저장하지 않는다. 좋아요·북마크 등 변경 요청은 성공만 돌려주고 화면 데이터는 그대로다.
// 이미지·동영상 URL 은 null/빈 목록이다(next.config.ts 의 CSP img-src 가 http://localhost:8080 을 허용하지 않는다).

import { createServer } from 'node:http';

const PORT = Number(process.env.PORT) || 8080;
const ALLOWED_ORIGINS = new Set(['http://localhost:3000', 'http://127.0.0.1:3000']);
const TEST_ID = 'tester';
const TEST_PASSWORD = 'test1234';

const ago = (min) => new Date(Date.now() - min * 60_000).toISOString();
const cursor = (items) => ({ items, nextCursor: null, hasNext: false });
const pageOf = (content) => ({ content, number: 0, size: 10, totalPages: content.length ? 1 : 0, totalElements: content.length, first: true, last: true, empty: !content.length });

// ---- 사용자 -------------------------------------------------------------
const viewer = { userId: TEST_ID, handle: TEST_ID, nickname: '테스터', role: 'USER', status: 'ACTIVE' };
const users = [
  { id: TEST_ID, handle: TEST_ID, nickname: '테스터', bio: '게임 이야기를 나눠요. 배그와 롤을 주로 합니다.', location: '서울', website: 'https://example.com', verified: false, member: true },
  { id: 'u-minjun', handle: 'sniper_min', nickname: '민준', bio: '배그 스나이퍼. 에란겔 장거리 저격이 취미.', location: '부산', website: null, verified: true, member: false },
  { id: 'u-yuna', handle: 'rank_yuna', nickname: '유나', bio: '롤 다이아 정글러, 주말 코칭 가능', location: '인천', website: null, verified: false, member: true },
  { id: 'u-dohyun', handle: 'tank_dohyun', nickname: '도현', bio: '오버워치 탱커 장인', location: null, website: null, verified: false, member: false },
  { id: 'u-seoyeon', handle: 'support_seoyeon', nickname: '서연', bio: '서포터는 사랑입니다. 같이 듀오 하실 분!', location: '대전', website: null, verified: false, member: false },
  { id: 'u-hajun', handle: 'pubg_hajun', nickname: '하준', bio: null, location: '광주', website: null, verified: false, member: false },
];
const byHandle = (h) => users.find((u) => u.handle === h);
const pubgStats = { PUBG: { connected: true, playerName: 'Tester_PUBG', statsMode: 'RANKED', tierLabel: 'GOLD', winRate: 12.5, kd: 2.4, matches: 148 } };
const profileOf = (u, i = 0) => ({
  id: u.id, handle: u.handle, nickname: u.nickname, bio: u.bio, location: u.location, website: u.website,
  coverImageUrl: null, profileImageUrl: null, gameStats: u.id === TEST_ID ? pubgStats : {},
  verifiedBadge: u.verified, membershipBadge: u.member,
  followersCount: 120 + i * 37, followingCount: 40 + i * 5, postCount: posts.filter((p) => p.authorHandle === u.handle).length, mediaPostCount: 0, mediaItemCount: 0,
  followedByMe: u.id !== TEST_ID && i % 2 === 1, followsViewer: u.id !== TEST_ID && i % 2 === 0,
});
const followRecord = (u, i) => ({
  userId: u.id, handle: u.handle, nickname: u.nickname, bio: u.bio, profileImageUrl: null,
  verifiedBadge: u.verified, membershipBadge: u.member, isFollowing: i % 2 === 0, followedAt: ago(60 * 24 * (i + 1)),
});
const actorOf = (u) => ({ userId: u.id, handle: u.handle, nickname: u.nickname, profileImageUrl: null, verifiedBadge: u.verified, membershipBadge: u.member });

// ---- 게시물 -------------------------------------------------------------
const mkPost = (n, handle, content, o = {}) => {
  const u = byHandle(handle);
  return {
    postId: `post-${n}`, postNumber: n, author: u.nickname, authorHandle: u.handle, authorProfileImageUrl: null,
    authorVerifiedBadge: u.verified, authorMembershipBadge: u.member, game: null, content, media: [],
    likes: 3 + n * 4, comments: n % 4, shares: n % 3, isReposted: false, repostCount: n % 2, viewCount: n * 137,
    likedByMe: false, bookmarkedByMe: false, mine: handle === TEST_ID, createdAt: ago(n * 47), ...o,
  };
};
const posts = [
  mkPost(1, 'sniper_min', '오늘 에란겔 막판 원 줄었을 때 600m 헤드샷 성공!! 손이 떨려서 한참 말도 못했다 #배그 #스나이퍼', { game: 'PUBG', likes: 42, comments: 3, likedByMe: true, viewCount: 12_345 }),
  mkPost(2, 'rank_yuna', '다이아 승급전 3연패 후 겨우 올라감. 멘탈 관리가 제일 중요한 듯 #롤 #랭크', { game: 'LOL', likes: 31, comments: 2, bookmarkedByMe: true, viewCount: 1_234_567 }),
  mkPost(3, 'tank_dohyun', '탱커 하면서 느낀 점: 핑 하나 안 찍는 팀원보다 말없이 같이 밀어주는 팀원이 더 고맙다.'),
  mkPost(4, 'support_seoyeon', '듀오 구합니다. 평일 저녁 9시 이후, 마이크 가능하신 분이면 좋겠어요. 티어 무관, 분위기 좋은 분 환영! #듀오 #롤', { likedByMe: true, bookmarkedByMe: true, comments: 1 }),
  mkPost(5, TEST_ID, '디자인 점검용 게시물입니다 @sniper_min 님 멘션 테스트. 아주 긴 글이 어떻게 줄바꿈되는지도 확인하려고 조금 길게 씁니다. 배틀그라운드에서 자기장이 줄어들 때 차량을 어디에 세워 두느냐가 후반 생존율을 크게 좌우한다고 생각합니다. 여러분은 어떻게 생각하세요? #배그 #전략', { game: 'PUBG', likes: 7, comments: 2, mine: true, editableUntil: ago(-60), editCount: 0, viewCount: 0 }),
  mkPost(6, 'pubg_hajun', '치킨 먹었다 🍗', { likes: 12 }),
  mkPost(7, 'rank_yuna', '이번 시즌 정글 챔피언 티어 정리해봤습니다. 1티어는 변함없이 같고 메타가 안정된 느낌. 질문은 댓글로 주세요!', { game: 'LOL', isReposted: true, repostCount: 5, reposterInfo: { userId: 'u-minjun', nickname: '민준', repostedAt: ago(30) } }),
  mkPost(8, 'sniper_min', '새 키보드 샀는데 소리가 너무 좋다 #장비', { likes: 19, bookmarkedByMe: true }),
];
const viewedPostIds = new Set();
const postById = (id) => posts.find((p) => p.postId === id || String(p.postNumber) === id);
const comments = [
  { commentId: 'comment-1', author: '유나', authorHandle: 'rank_yuna', authorProfileImageUrl: null, authorVerifiedBadge: false, authorMembershipBadge: true, content: '와 이건 클립 올려야죠!', createdAt: ago(20), mine: false },
  { commentId: 'comment-2', author: '테스터', authorHandle: TEST_ID, authorProfileImageUrl: null, authorVerifiedBadge: false, authorMembershipBadge: true, content: '저도 같은 생각이에요.', createdAt: ago(8), mine: true },
  { commentId: 'comment-3', author: '도현', authorHandle: 'tank_dohyun', authorProfileImageUrl: null, authorVerifiedBadge: false, content: '공감합니다 ㅋㅋ 다음엔 같이 해요', createdAt: ago(3), mine: false },
];
const collections = [
  { collectionId: 'collection-1', name: '게임 모음', coverImageUrl: null, bookmarkCount: 3, createdAt: ago(5000), updatedAt: ago(100) },
  { collectionId: 'collection-2', name: '공략 저장', coverImageUrl: null, bookmarkCount: 0, createdAt: ago(3000), updatedAt: ago(3000) },
];
const hashtags = [
  { hashtagId: 'tag-1', name: '배그', postCount: 128 }, { hashtagId: 'tag-2', name: '롤', postCount: 96 },
  { hashtagId: 'tag-3', name: '듀오', postCount: 41 }, { hashtagId: 'tag-4', name: '장비', postCount: 17 },
];

// ---- 알림·메시지 ---------------------------------------------------------
const notif = (id, type, u, extra, read, min) => ({
  notificationId: id, type, actor: actorOf(u), postId: null, postNumber: null, commentId: null, conversationId: null,
  messageId: null, mentoringApplicationId: null, mentoringReviewId: null, read, createdAt: ago(min), ...extra,
});
const notifications = [
  notif('notification-1', 'like', byHandle('sniper_min'), { postId: 'post-5', postNumber: 5 }, false, 5),
  notif('notification-2', 'follow', byHandle('rank_yuna'), {}, false, 90),
  notif('notification-3', 'comment', byHandle('tank_dohyun'), { postId: 'post-5', postNumber: 5, commentId: 'comment-3' }, true, 60 * 26),
];
const recipients = [
  { id: 'u-yuna', name: '유나', handle: '@rank_yuna', role: 'USER', online: true, profileImageUrl: null, membershipBadge: true },
  { id: 'u-seoyeon', name: '서연', handle: '@support_seoyeon', role: 'USER', online: false, profileImageUrl: null, membershipBadge: false },
];
const msg = (id, from, text, min, extra = {}) => ({ id, senderId: from, text, createdAt: ago(min), read: true, deliveryStatus: 'sent', attachments: [], sharedPost: null, ...extra });
const chats = {
  'conversation-1': [
    msg('m-1', 'u-yuna', '안녕하세요! 멘토링 문의 주셨죠?', 130),
    msg('m-2', 'me', '네, 주말 오후 시간 가능한가요?', 125),
    msg('m-3', 'u-yuna', '토요일 3시 괜찮아요. 이 글 한번 보세요.', 120, { sharedPost: { postId: 'post-7', postNumber: 7, author: '유나', authorHandle: 'rank_yuna', content: posts[6].content, createdAt: posts[6].createdAt } }),
  ],
  'conversation-2': [msg('m-4', 'me', '듀오 아직 구하세요?', 60 * 5), msg('m-5', 'u-seoyeon', '네! 오늘 밤 9시 어때요?', 60 * 4, { read: false })],
};
const conversations = [
  { id: 'conversation-1', recipient: recipients[0], messages: chats['conversation-1'], unreadCount: 0, updatedAt: ago(120) },
  { id: 'conversation-2', recipient: recipients[1], messages: chats['conversation-2'], unreadCount: 1, updatedAt: ago(60 * 4) },
];

// ---- 멘토링·마일리지·결제 ------------------------------------------------
const mentor = { userId: TEST_ID, nickname: '테스터', status: 'ACTIVE', about: '게임 코칭 멘토입니다. 배그 운영과 에임 훈련을 알려드려요.', ratingAvg: 4.5, reviewCount: 2, menteeCount: 5, membershipBadge: true };
const mkProgram = (id, mentorId, mentorNickname, gameName, title, price, tags, o = {}) => ({
  id, mentorId, mentorNickname, gameName, title,
  content: '[진행 방식]\n온라인 1:1 코칭\n\n[상세 설명]\n기본기부터 운영까지 단계별로 알려드립니다.',
  availableTimeDesc: '주말 오후', status: 'ACTIVE', price, tags, createdAt: ago(60 * 24 * 3), membershipBadge: false, ...o,
});
const programs = [
  mkProgram('program-1', TEST_ID, '테스터', 'PUBG', '배그 후반 운영 코칭', 10000, ['운영', '기본기'], { membershipBadge: true }),
  mkProgram('program-2', 'u-yuna', '유나', 'LOL', '정글 동선과 오브젝트 관리', 15000, ['정글', '다이아'], { membershipBadge: true, availableTimeDesc: '평일 저녁' }),
  mkProgram('program-3', 'u-dohyun', '도현', 'OVERWATCH', '탱커 포지셔닝 입문', 8000, ['탱커'], { status: 'CLOSED' }),
];
const application = { id: 'application-1', programId: 'program-1', programTitle: programs[0].title, mentorId: TEST_ID, mentorNickname: '테스터', menteeId: 'u-seoyeon', menteeNickname: '서연', appliedMileage: 10000, status: 'COMPLETED', paymentStatus: 'SETTLED', message: '운영을 배우고 싶어요.', createdAt: ago(60 * 24 * 2), reviewed: false };
const appStatuses = ['APPLIED', 'ACCEPTED', 'ONGOING', 'FINISHED', 'COMPLETED', 'REJECTED', 'CANCELLED'];
const applications = appStatuses.map((status, i) => ({ ...application, id: `application-${i}`, status, paymentStatus: status === 'COMPLETED' ? 'SETTLED' : ['REJECTED', 'CANCELLED'].includes(status) ? 'REFUNDED' : 'ESCROW_HELD', createdAt: ago(60 * (i + 1)) }));
const myApplications = applications.map((a) => ({ ...a, id: `my-${a.id}`, mentorId: 'u-yuna', mentorNickname: '유나', menteeId: TEST_ID, menteeNickname: '테스터', programId: 'program-2', programTitle: programs[1].title }));
const reviews = [
  { id: 'review-1', applicationId: 'application-4', programId: 'program-1', programTitle: programs[0].title, menteeNickname: '서연', rating: 5, content: '알기 쉬운 코칭이었습니다.', createdAt: ago(60 * 20), membershipBadge: false },
  { id: 'review-2', applicationId: 'application-3', programId: 'program-1', programTitle: programs[0].title, menteeNickname: '하준', rating: 4, content: '후반 운영 관점이 바뀌었어요.', createdAt: ago(60 * 50), membershipBadge: false },
];
const transactions = [
  { id: 'tx-1', amount: 50000, balanceAfter: 50000, type: 'CHARGE', typeDescription: '충전', description: '마일리지 충전', createdAt: ago(60 * 24 * 7) },
  { id: 'tx-2', amount: -10000, balanceAfter: 40000, type: 'MENTORING_PAYMENT', typeDescription: '멘토링 결제', description: '정글 동선과 오브젝트 관리', createdAt: ago(60 * 24 * 3) },
  { id: 'tx-3', amount: 10000, balanceAfter: 50000, type: 'REFUND', typeDescription: '환불', description: '멘토링 신청 취소 환불', createdAt: ago(60 * 24) },
];
const products = [
  { productCode: 'MILEAGE_5000', purpose: 'MILEAGE_CHARGE', name: '마일리지 5,000', price: 5000, mileage: 5000, durationDays: null },
  { productCode: 'MILEAGE_10000', purpose: 'MILEAGE_CHARGE', name: '마일리지 10,000', price: 10000, mileage: 10000, durationDays: null },
  { productCode: 'MEMBERSHIP_30D', purpose: 'MEMBERSHIP_PASS', name: '멤버십 30일 이용권', price: 4900, mileage: null, durationDays: 30 },
];
const payments = [
  { orderId: 'order-1', status: 'APPROVED', purpose: 'MILEAGE_CHARGE', productCode: 'MILEAGE_10000', itemName: '마일리지 10,000', amount: 10000, paymentMethodType: 'CARD', createdAt: ago(60 * 24 * 7), approvedAt: ago(60 * 24 * 7), canceledAt: null },
  { orderId: 'order-2', status: 'CANCELED', purpose: 'MEMBERSHIP_PASS', productCode: 'MEMBERSHIP_30D', itemName: '멤버십 30일 이용권', amount: 4900, paymentMethodType: 'MONEY', createdAt: ago(60 * 24 * 20), approvedAt: ago(60 * 24 * 20), canceledAt: ago(60 * 24 * 19) },
];
const membership = { active: true, expiresAt: new Date(Date.now() + 20 * 86_400_000).toISOString(), price: 4900, durationDays: 30, benefits: ['프로필 노란 체크 배지', '멘토링 정산 수수료 할인', '게시물 수정 가능 시간 연장'] };
const reportReasons = [{ code: 'SPAM', label: '스팸' }, { code: 'OTHER', label: '기타' }];

// ---- 라우팅 -------------------------------------------------------------
const NOT_FOUND = Symbol('notFound');
const STREAM = Symbol('stream');

function route(method, path, url) {
  let m;
  const q = url.searchParams;
  // 인증
  if (path === '/api/v1/auth/refresh') return { userId: TEST_ID, accessToken: 'mock-access-token' };
  if (path === '/api/v1/auth/me') return viewer;
  if (path === '/api/v1/auth/logout') return null;
  if (path === '/api/v1/auth/email-verifications') return { expiresInSeconds: 300, resendCooldownSeconds: 60 };
  if (path === '/api/v1/auth/email-verifications/confirm') return { verificationToken: 'mock-verification-token', expiresInSeconds: 1800 };
  if (path === '/api/v1/auth/signup' || path === '/api/v1/auth/social-signup') return { userId: TEST_ID, accessToken: 'mock-access-token' };

  if (method === 'GET') {
    if (path === '/api/v1/feed') return cursor(posts);
    if ((m = path.match(/^\/api\/v1\/posts\/(?:by-number\/)?([^/]+)$/))) return postById(m[1]) ?? NOT_FOUND;
    if (/^\/api\/v1\/posts\/[^/]+\/comments$/.test(path)) return comments;
    if (path === '/api/v1/users/me/bookmarks') return cursor(posts.filter((p) => p.bookmarkedByMe));
    if (path === '/api/v1/bookmark-collections') return collections;
    if (/^\/api\/v1\/bookmark-collections\/[^/]+\/bookmarks$/.test(path)) return cursor(posts.filter((p) => p.bookmarkedByMe).slice(0, 2));
    if ((m = path.match(/^\/api\/v1\/hashtags\/([^/]+)\/posts$/))) return cursor(posts.filter((p) => p.content?.includes(`#${decodeURIComponent(m[1])}`)));
    if (path === '/api/v1/hashtags') return hashtags;
    if (path === '/api/v1/users/me') return profileOf(users[0]);
    if ((m = path.match(/^\/api\/v1\/users\/([^/]+)$/))) { const u = byHandle(decodeURIComponent(m[1])); return u ? profileOf(u, users.indexOf(u)) : NOT_FOUND; }
    if ((m = path.match(/^\/api\/v1\/users\/([^/]+)\/(posts|media|followers|following)$/))) {
      const h = decodeURIComponent(m[1]) === 'me' ? TEST_ID : decodeURIComponent(m[1]);
      if (m[2] === 'posts') return cursor(posts.filter((p) => p.authorHandle === h));
      if (m[2] === 'media') return cursor([]);
      return cursor(users.filter((u) => u.handle !== h).map(followRecord));
    }
    if (path === '/api/v1/notifications/unread-count') return { unreadCount: notifications.filter((n) => !n.read).length };
    if (path === '/api/v1/notifications') return cursor(notifications);
    if (path === '/api/v1/messages/conversations') return conversations;
    if ((m = path.match(/^\/api\/v1\/messages\/conversations\/([^/]+)\/messages$/))) return cursor(chats[m[1]] ?? []);
    if (path === '/api/v1/messages/recipients') return recipients;
    if (path === '/api/v1/messages/stream') return STREAM;
    if (path.startsWith('/api/v1/messages/attachments/')) return NOT_FOUND;
    if (path === '/api/v1/search') {
      return { query: q.get('q') ?? '', accounts: { items: users.slice(1, 4).map((u, i) => profileOf(u, i + 1)), hasMore: false }, posts: { items: posts.slice(0, 3), hasMore: false }, hashtags: { items: hashtags.slice(0, 3), hasMore: false } };
    }
    if (path === '/api/v1/search/accounts') return cursor(users.slice(1).map((u, i) => profileOf(u, i + 1)));
    if (path === '/api/v1/search/posts') return cursor(posts);
    if (path === '/api/v1/search/hashtags') return hashtags;
    if (path === '/api/v1/games') return [{ code: 'LOL', name: 'League of Legends' }, { code: 'PUBG', name: 'PUBG' }, { code: 'R6', name: 'Rainbow Six Siege' }, { code: 'OVERWATCH', name: 'Overwatch' }];
    if (path === '/api/v1/mentoring/mentors/me') return mentor;
    if ((m = path.match(/^\/api\/v1\/mentoring\/mentors\/([^/]+)$/))) return m[1] === TEST_ID ? mentor : { ...mentor, userId: m[1], nickname: byHandle(m[1])?.nickname ?? '멘토', membershipBadge: false };
    if (path === '/api/v1/mentoring/programs') return pageOf(programs);
    if ((m = path.match(/^\/api\/v1\/mentoring\/programs\/([^/]+)$/))) { const p = programs.find((x) => x.id === m[1]); return p ? { ...p, mentorAbout: mentor.about } : NOT_FOUND; }
    if (path === '/api/v1/mentoring/applications/mentee') return pageOf(myApplications);
    if (path === '/api/v1/mentoring/applications/mentor') return pageOf(applications);
    if (path === '/api/v1/mentoring/reviews') return pageOf(reviews);
    if (path.startsWith('/api/v1/mentoring/') && path.endsWith('/reviews')) return pageOf(reviews);
    if (path === '/api/v1/mileage/me/balance') return { currentBalance: 50000 };
    if (path === '/api/v1/mileage/me/transactions') return pageOf(transactions);
    if (path === '/api/v1/memberships/me') return membership;
    if (path === '/api/v1/payments/products') return products;
    if (path === '/api/v1/payments') return cursor(payments);
    if ((m = path.match(/^\/api\/v1\/payments\/([^/]+)$/))) return payments.find((p) => p.orderId === m[1]) ?? payments[0];
    if (path === '/api/v1/reports/my') return pageOf([]);
    if (path === '/api/v1/reports/reasons') return reportReasons;
    if (path === '/api/v1/pubg/me') return { game: 'PUBG', ...pubgStats.PUBG };
    if (path === '/api/v1/riot/lol/me') return { gameName: 'Tester#KR1', tierLabel: 'DIAMOND 4', kda: 3.1, winRate: 54, games: 210, connected: true };
    return NOT_FOUND;
  }

  // 변경 요청: 호출부가 응답 객체를 쓰는 것만 값을 돌려주고 나머지는 data: null.
  if (path === '/api/v1/messages/stream-token') return { expiresAt: '2099-01-01T00:00:00Z' };
  if (method === 'POST' && path === '/api/v1/posts') return posts[4];
  if ((m = path.match(/^\/api\/v1\/posts\/([^/]+)$/)) && method === 'PATCH') return postById(m[1]) ?? posts[4];
  if ((m = path.match(/^\/api\/v1\/posts\/([^/]+)\/reposts$/))) return { postId: m[1], isReposted: method === 'POST', repostCount: method === 'POST' ? 1 : 0 };
  if ((m = path.match(/^\/api\/v1\/posts\/([^/]+)\/shares$/))) return { postId: m[1], shares: 1 };
  if (method === 'POST' && /^\/api\/v1\/posts\/[^/]+\/comments$/.test(path)) return { ...comments[1], commentId: `comment-${Date.now()}`, createdAt: ago(0) };
  if (method === 'POST' && path === '/api/v1/bookmark-collections') return collections[0];
  if (method === 'PATCH' && /^\/api\/v1\/bookmark-collections\/[^/]+$/.test(path)) return collections[0];
  if ((m = path.match(/^\/api\/v1\/bookmark-collections\/([^/]+)\/bookmarks\/([^/]+)$/))) return { postId: m[2], bookmarkedByMe: method === 'PUT', collectionIds: method === 'PUT' ? [m[1]] : [], collection: collections[0] };
  if (method === 'POST' && path === '/api/v1/users/me/profile-images') return { target: 'PROFILE', imageUrl: '', sizeBytes: 0 };
  if (method === 'POST' && path === '/api/v1/messages/conversations') return conversations[0];
  if (method === 'POST' && path === '/api/v1/messages/share-post') return conversations;
  if (method === 'POST' && /^\/api\/v1\/messages\/conversations\/[^/]+\/messages$/.test(path)) return msg(`m-${Date.now()}`, 'me', '(목) 전송됨', 0);
  if (method === 'POST' && path === '/api/v1/mentoring/mentors') return mentor;
  if (method === 'POST' && path === '/api/v1/mentoring/programs') return programs[0];
  if (method === 'PATCH' && /^\/api\/v1\/mentoring\/programs\//.test(path)) return programs[0];
  if (path.startsWith('/api/v1/mentoring/applications')) return method === 'DELETE' ? null : application;
  if (method === 'POST' && path === '/api/v1/mentoring/reviews') return reviews[0];
  if (method === 'POST' && path === '/api/v1/payments/kakao/ready') return { orderId: 'order-mock', status: 'READY', pcUrl: null, mobileUrl: null };
  if (method === 'POST' && /^\/api\/v1\/payments\/(kakao\/approve|[^/]+\/cancel)$/.test(path)) return payments[0];
  if (method === 'POST' && path === '/api/v1/riot/connect') return { connected: true, riotId: 'Tester#KR1' };
  if (method === 'POST' && path === '/api/v1/pubg/connect') return { connected: true, playerName: 'Tester_PUBG' };
  if (method === 'POST' && path === '/api/v1/r6/connect') return { connected: true, playerName: 'Tester_R6', platform: 'PC' };
  if (method === 'POST' && path === '/api/v1/r6/me/refresh') return { game: 'R6', connected: true, playerName: 'Tester_R6', tierLabel: 'GOLD', kd: 1.2, winRate: 50, matches: 80, statsMode: 'RANKED', platform: 'PC', updatedAt: ago(5) };
  if (method === 'POST' && path === '/api/v1/reports') return { id: 'report-1', reportCode: 'R-0001', reporterId: TEST_ID, reporterNickname: '테스터', targetType: 'POST', targetId: 'post-1', targetSnippet: null, reasonCode: 'SPAM', reasonLabel: '스팸', details: null, status: 'RECEIVED', assignedAdminId: null, assignedAdminNickname: null, createdAt: ago(0), updatedAt: ago(0) };
  // likes/bookmarks/follow/read/read-all/삭제 등: 성공만 돌려준다. 위에 없는 경로도 여기로 오므로 로그를 남긴다.
  if (/\/(likes|bookmarks|follow|read|read-all|password)$/.test(path) || method === 'DELETE' || method === 'PATCH' || method === 'PUT') return null;
  return NOT_FOUND;
}

// ---- 서버 ---------------------------------------------------------------
function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
}
const send = (res, status, body, extra = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...extra });
  res.end(JSON.stringify(body));
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://mock');
  const path = url.pathname;
  cors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || 'Authorization,Content-Type',
      'Access-Control-Max-Age': '600',
    });
    res.end();
    return;
  }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');

  if (req.method === 'POST' && path === '/api/v1/auth/login') {
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch { /* 형식 오류는 아래에서 401 */ }
    if (body.handle === TEST_ID && body.password === TEST_PASSWORD) {
      send(res, 200, { success: true, data: { userId: TEST_ID, accessToken: 'mock-access-token' } }, {
        'Set-Cookie': 'refresh_token=mock-refresh; Path=/; HttpOnly; SameSite=Lax',
      });
    } else {
      send(res, 401, { success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
    return;
  }

  // 카드 노출 보고(#183). 실제 서버처럼 같은 글은 한 번만 센다(목은 서버를 다시 켤 때까지).
  if (req.method === 'POST' && path === '/api/v1/posts/views') {
    let ids = [];
    try { ids = JSON.parse(raw || '{}').postIds ?? []; } catch { /* 형식 오류는 아래에서 400 */ }
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 50) {
      send(res, 400, { success: false, message: 'postIds는 1~50개여야 합니다.' });
      return;
    }
    const counted = ids.map(postById).filter((p) => p && !viewedPostIds.has(p.postId));
    counted.forEach((p) => { viewedPostIds.add(p.postId); p.viewCount += 1; });
    console.log(`[mock] views ${ids.length} reported, ${counted.length} counted`);
    send(res, 200, { success: true, data: { counted: counted.length } });
    return;
  }

  if (!path.startsWith('/api/v1/')) {
    console.log(`[mock] 404 ${req.method} ${path}`);
    send(res, 404, { success: false, message: 'mock: not implemented' });
    return;
  }

  const data = route(req.method ?? 'GET', path, url);
  if (data === STREAM) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': connected\n\n');
    const timer = setInterval(() => res.write(': keepalive\n\n'), 15_000);
    req.on('close', () => clearInterval(timer));
    return;
  }
  if (data === NOT_FOUND) {
    console.log(`[mock] 404 ${req.method} ${path}`);
    send(res, 404, { success: false, message: 'mock: not implemented' });
    return;
  }
  const extra = path === '/api/v1/messages/stream-token' ? { 'Set-Cookie': 'stream_token=mock; Path=/; HttpOnly; SameSite=Lax' }
    : path === '/api/v1/auth/logout' ? { 'Set-Cookie': 'refresh_token=; Path=/; HttpOnly; Max-Age=0' } : {};
  send(res, 200, { success: true, data }, extra);
}).listen(PORT, () => console.log(`[mock] listening on http://localhost:${PORT} (test account: ${TEST_ID} / ${TEST_PASSWORD})`));
