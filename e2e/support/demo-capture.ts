import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { auditPost, auditProgram, auditUser, installAuditFixture } from './fe8-audit';

const date = '2026-11-09T05:00:00Z';
const cursor = { items: [], nextCursor: null, hasNext: false };
const pageOf = (content: unknown[]) => ({ content, number: 0, size: 10, totalPages: content.length ? 1 : 0, totalElements: content.length, first: true, last: true, empty: !content.length });
const user = { ...auditUser, nickname: '새벽의듀오' };
const pubg = { game: 'PUBG', connected: true, playerName: 'DAWN_DUO', statsMode: 'RANKED', tierLabel: 'Diamond 1', winRate: 18, kd: 3.42, matches: 42 };
const valorant = { game: 'VALORANT', connected: true, riotId: 'Dawn#KR1', region: 'KR', platform: 'PC', tierLabel: 'Ascendant 3', peakTierLabel: 'Immortal 1', rr: 68, kd: 1.38, acs: 246, headshotRate: 28, winRate: 62, matches: 10, updatedAt: date };
export const captureProgram = { ...auditProgram, mentorId: 'recipient', mentorNickname: '클러치코치', gameName: 'VALORANT', title: '클러치 판단과 포지셔닝', content: '[진행 방식]\n1:1 영상 피드백\n\n[상세 설명]\n내 플레이를 함께 보며, 놓치고 있던 판단과 포지셔닝 습관을 찾습니다.', tags: ['판단', '포지셔닝'], availableTimeDesc: '평일 저녁 · 주말 협의', price: 10000 };
const mentor = { userId: 'recipient', nickname: '클러치코치', status: 'ACTIVE', about: '발로란트 불멸 III · 플레이 영상으로 함께 찾는 다음 한 수', ratingAvg: 4.9, reviewCount: 24, menteeCount: 31 };
export const capturePost = { ...auditPost, author: user.nickname, authorHandle: 'viewer', content: '오늘의 클러치. 마지막 판단, 어땠나요? #발로란트', game: 'VALORANT', media: [{ mediaId: 'demo-video', mediaType: 'VIDEO', mediaUrl: 'http://127.0.0.1:3000/demo-assets/valorant-highlight.mp4', thumbnailUrl: 'http://127.0.0.1:3000/demo-assets/valorant-thumb-2.jpg', sortOrder: 0 }], likes: 28, comments: 2, repostCount: 3, mine: true, bookmarkedByMe: false, createdAt: date };

/** 실제 페이지는 그대로 렌더한다. 이 Playwright 페이지의 요청만 가로채며 서버 상태를 바꾸지 않는다. */
export async function installDemoCapture(page: Page) {
  await installAuditFixture(page, 'dark', { linkedStats: true, programState: 'apply', mentor: false });
  const state = { linked: false, posted: false, status: 'APPLIED', applied: false, reviewed: false, shared: false, feedback: false };
  const writes: string[] = [];
  const application = () => ({ id: 'application-demo', programId: captureProgram.id, programTitle: captureProgram.title, mentorId: 'recipient', mentorNickname: mentor.nickname, menteeId: 'viewer', menteeNickname: user.nickname, appliedMileage: 10000, status: state.status, paymentStatus: state.status === 'COMPLETED' ? 'SETTLED' : 'ESCROW_HELD', message: '마지막 진입 판단과 포지셔닝을 배우고 싶어요.', createdAt: date, reviewed: state.reviewed });
  const message = (id: string, text: string, mine = false) => ({ id, senderId: mine ? 'me' : 'recipient', text, createdAt: new Date(Date.parse(date) + (id === 'feedback' ? 120_000 : id === 'shared' ? 60_000 : 0)).toISOString(), read: true, deliveryStatus: 'sent', attachments: [], sharedPost: null });
  const messages = () => [message('welcome', '반가워요! 함께 살펴볼 플레이 영상을 보내주세요.'), ...(state.shared ? [{ ...message('shared', '마지막 진입 판단이 궁금해요.', true), attachments: [{ id: 'demo-video', type: 'video', name: '오늘의 클러치.mp4', url: '/api/v1/messages/attachments/demo-video' }] }] : []), ...(state.feedback ? [message('feedback', '에임은 좋아요. 다음엔 엄폐물 쪽으로 한 발 물러나 각을 하나씩 확인해보세요.')] : [])];
  const recipient = { id: 'recipient', name: mentor.nickname, handle: '@clutchcoach', role: 'USER', online: true };
  const profile = () => ({ id: 'viewer', handle: 'viewer', nickname: user.nickname, bio: '오늘의 플레이를 기록하고, 함께 더 나은 한 판을 만듭니다.', location: '대한민국', website: null, coverImageUrl: null, profileImageUrl: null, gameStats: { PUBG: pubg, ...(state.linked ? { VALORANT: valorant } : {}) }, verifiedBadge: false, followersCount: 128, followingCount: 86, postCount: state.posted ? 1 : 0, mediaPostCount: state.posted ? 1 : 0, mediaItemCount: state.posted ? 1 : 0 });
  await page.route('**/demo-assets/*', async (route) => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    if (!['valorant-highlight.mp4', ...[1, 2, 3].map((n) => `valorant-thumb-${n}.jpg`)].includes(name)) return route.abort();
    await route.fulfill({ path: join(process.cwd(), 'public/demo-assets', name), contentType: name.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg' });
  });
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (!['GET', 'HEAD'].includes(request.method())) writes.push(`${request.method()} ${path}`);
    let data: unknown;
    if (path === '/api/v1/auth/me') data = user;
    else if (path === '/api/v1/users/me/recommendations') data = [{ userId: 'recipient', handle: 'clutchcoach', nickname: '클러치코치', profileImageUrl: null, verifiedBadge: false, followedByMe: false, winRate: 68, mutualCount: 3 }];
    else if (path === '/api/v1/users/me' || path === '/api/v1/users/viewer') data = profile();
    else if (path === '/api/v1/pubg/me') data = pubg;
    else if (path === '/api/v1/valorant/connect') { state.linked = true; data = valorant; }
    else if (path === '/api/v1/valorant/me/refresh') data = valorant;
    else if (path === '/api/v1/feed' || path === '/api/v1/users/viewer/posts') data = { ...cursor, items: state.posted ? [capturePost] : [] };
    else if (/\/posts\/(post-1|by-number\/1)$/.test(path)) data = capturePost;
    else if (path === '/api/v1/posts/post-1/comments') data = [0, 1].map((i) => ({ commentId: `comment-${i}`, author: ['에임연습중', '포지션메이트'][i], authorHandle: ['aimpractice', 'positionmate'][i], content: ['마지막 침착한 에임, 멋져요!', '저 타이밍에 들어가는 판단 좋네요.'][i], createdAt: date, mine: false }));
    else if (path === '/api/v1/posts' && request.method() === 'POST') { state.posted = true; data = { jobId: 'demo-post-job', status: 'COMPLETED', errorCode: null, errorMessage: null, post: capturePost, message: null }; }
    else if (path.includes('/upload-jobs/')) data = { jobId: 'demo-post-job', status: 'COMPLETED', errorCode: null, errorMessage: null, post: capturePost, message: null };
    else if (path === '/api/v1/games') data = [{ code: 'VALORANT', name: 'VALORANT' }, { code: 'PUBG', name: 'PUBG' }, { code: 'LOL', name: 'League of Legends' }];
    else if (path.endsWith('/mentoring/programs')) data = pageOf([captureProgram]);
    else if (path.endsWith('/mentoring/programs/program-1')) data = { ...captureProgram, mentorAbout: mentor.about };
    else if (path.endsWith('/mentoring/mentors/recipient')) data = mentor;
    else if (path.endsWith('/mentoring/mentors/recipient/reviews')) data = pageOf(['왜 그 판단이 필요한지 이해됐어요.', '제 리플레이로 설명해줘서 바로 적용했어요.', '포지셔닝에서 놓치던 습관을 찾았어요.'].map((content, i) => ({ id: `review-${i}`, programId: captureProgram.id, programTitle: captureProgram.title, menteeNickname: ['원탭연습중', '다음라운드', '클러치메이트'][i], rating: 5, content, createdAt: date })));
    else if (path.endsWith('/mentoring/applications/mentee')) data = pageOf(state.applied ? [application()] : []);
    else if (path.endsWith('/mentoring/applications/mentor')) data = pageOf([]);
    else if (path.endsWith('/mentoring/applications') && request.method() === 'POST') { state.applied = true; data = application(); }
    else if (path.endsWith('/application-demo/complete')) { state.status = 'COMPLETED'; data = application(); }
    else if (path.endsWith('/mentoring/reviews') && request.method() === 'POST') { state.reviewed = true; data = { id: 'review-new', applicationId: 'application-demo', programId: captureProgram.id, programTitle: captureProgram.title, menteeNickname: user.nickname, rating: 5, content: '다음 플레이에서 무엇을 바꿀지 알겠어요.', createdAt: date }; }
    else if (path.endsWith('/messages/conversations')) data = [{ id: 'conversation-1', recipient, messages: messages(), unreadCount: 0, updatedAt: date }];
    else if (path.endsWith('/conversation-1/messages')) data = { ...cursor, items: messages() };
    else if (path.endsWith('/messages/attachments/demo-video')) { await route.fulfill({ path: join(process.cwd(), 'public/demo-assets/valorant-highlight.mp4'), contentType: 'video/mp4' }); return; }
    else return route.fallback();
    await route.fulfill({ json: { success: true, data } });
  });
  return { state, writes };
}
