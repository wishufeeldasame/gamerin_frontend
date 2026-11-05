// 사용법: node --experimental-strip-types capture.mts <outDir> [overrideCss]
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { installAuditFixture } from '../../../../../e2e/support/fe8-audit.ts';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [outDir, cssPath] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const css = cssPath ? readFileSync(cssPath, 'utf8') : '';

const date = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const svg = (a: string, b: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/><circle cx="560" cy="180" r="90" fill="#ffffff" opacity=".18"/><rect x="80" y="320" width="420" height="40" rx="20" fill="#ffffff" opacity=".2"/></svg>`;
const base = { authorProfileImageUrl: null, authorVerifiedBadge: false, game: null, shares: 0, isReposted: false, mine: false, bookmarkedByMe: false, likedByMe: false, repostCount: 0 };
const posts = [
  { ...base, postId: 'p1', author: 'Jin Park', authorHandle: 'jinplays', authorMembershipBadge: true, content: '오늘 랭크 5연승 찍었습니다. 매일 20분 에임 루틴 공유해요 #발로란트 #에임연습', likes: 24, comments: 8, repostCount: 3, likedByMe: true, bookmarkedByMe: true, createdAt: date(3),
    media: [1, 2].map(i => ({ mediaId: `m${i}`, mediaType: 'IMAGE', mediaUrl: 'data:image/svg+xml;utf8,' + encodeURIComponent(i === 1 ? svg('#3b2f63', '#e07a5f') : svg('#1d3557', '#2a9d8f')), thumbnailUrl: null, sortOrder: i })) },
  { ...base, postId: 'p2', author: 'Luna Choi', authorHandle: 'lunaraid', content: '이번 주 레이드 공대원 2명 구합니다. 평일 저녁 9시, 디스코드 필수 #로스트아크', media: [], likes: 7, comments: 15, repostCount: 1, createdAt: date(5) },
  { ...base, postId: 'p3', author: 'Theo Han', authorHandle: 'theostream', content: '테스트123', media: [], likes: 0, comments: 0, createdAt: date(15) },
];
const profilePosts = posts.map(p => ({ ...p, author: '테스터', authorHandle: 'viewer', mine: true }));

const browser = await chromium.launch();
for (const [name, path, width] of [['home-desktop', '/home', 1440], ['profile-desktop', '/profile/viewer', 1440], ['home-mobile', '/home', 390], ['profile-mobile', '/profile/viewer', 390]] as const) {
  const context = await browser.newContext({ viewport: { width, height: width > 500 ? 1000 : 844 }, deviceScaleFactor: 2, colorScheme: 'light', timezoneId: 'Asia/Seoul', baseURL: 'http://127.0.0.1:3000' });
  const page = await context.newPage();
  await installAuditFixture(page, 'light');
  // 나중에 등록한 route가 먼저 매칭된다.
  await page.route('**/uploads/demo-*.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: route.request().url().includes('demo-1') ? svg('#3b2f63', '#e07a5f') : svg('#1d3557', '#2a9d8f') }));
  await page.route('**/api/v1/feed?*', route => route.fulfill({ json: { success: true, data: { items: posts, nextCursor: null, hasNext: false } } }));
  await page.route('**/api/v1/users/viewer/posts?*', route => route.fulfill({ json: { success: true, data: { items: profilePosts, nextCursor: null, hasNext: false } } }));
  if (css) await page.addInitScript(css => { const add = () => { const s = document.createElement('style'); s.id = 'ds-v2'; s.textContent = css; document.head.appendChild(s); }; document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', add) : add(); }, css);
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}/${name}.png` });
  await context.close();
}
await browser.close();
console.log('done', outDir);
