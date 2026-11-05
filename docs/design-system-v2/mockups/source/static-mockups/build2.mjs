// GamerIN v2 레이아웃 시안 B: 현재 앱 골격(헤더+사이드바+피드+오른쪽 열)을 유지하고 조금 변형
import { readFileSync, writeFileSync } from 'node:fs';
const DIR = new URL('.', import.meta.url).pathname;
const IC = JSON.parse(readFileSync(DIR + 'icons.json', 'utf8'));
const icon = (n, size = 20, extra = '') => `<svg class="ic ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[n]}</svg>`;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const rich = s => esc(s).replace(/(#[^\s#]+)/g, '<a class="tag">$1</a>').replace(/(@[a-z0-9_]+)/g, '<a class="tag">$1</a>');

function thumb(kind, seed) {
  const pals = [['#1b2a49', '#5b3a6e', '#e07a5f'], ['#0f2027', '#203a43', '#2c7a7b'], ['#2b1d0e', '#6b3e1f', '#f5b93d'], ['#141e30', '#243b55', '#7aa2c9']];
  const [a, b, c] = pals[seed % pals.length];
  const fps = `
    <polygon points="0,250 220,190 420,230 640,170 800,210 800,450 0,450" fill="${b}" opacity=".9"/>
    <polygon points="0,320 300,270 560,300 800,260 800,450 0,450" fill="#000" opacity=".35"/>
    <rect x="470" y="150" width="90" height="140" fill="#000" opacity=".25"/><rect x="560" y="120" width="60" height="170" fill="#000" opacity=".18"/>
    <rect x="120" y="200" width="70" height="90" fill="#000" opacity=".2"/>
    <g stroke="#fff" stroke-width="3" opacity=".9"><line x1="400" y1="205" x2="400" y2="217"/><line x1="400" y1="233" x2="400" y2="245"/><line x1="380" y1="225" x2="392" y2="225"/><line x1="408" y1="225" x2="420" y2="225"/></g>
    <path d="M520 450 L600 330 L700 320 L760 450 Z" fill="#111" opacity=".85"/><rect x="600" y="315" width="120" height="22" rx="4" fill="#222"/>
    <rect x="20" y="20" width="110" height="110" rx="10" fill="#000" opacity=".45" stroke="#fff" stroke-opacity=".3"/><circle cx="75" cy="75" r="5" fill="#f5b93d"/><circle cx="100" cy="50" r="4" fill="#ef4444"/>
    <g font-family="Arial" font-weight="700" fill="#fff"><text x="660" y="40" font-size="14" opacity=".85">Nova  &gt;  Rook</text><text x="660" y="62" font-size="14" opacity=".85">Nova  &gt;  Ash</text>
    <text x="30" y="318" font-size="30">100</text><text x="680" y="318" font-size="30">24<tspan font-size="18" opacity=".7"> / 90</tspan></text></g>
    <rect x="95" y="298" width="160" height="10" rx="5" fill="#fff" opacity=".25"/><rect x="95" y="298" width="130" height="10" rx="5" fill="#4ade80"/>`;
  const moba = `
    <rect width="800" height="450" fill="${b}"/><path d="M0 330 Q200 280 400 320 T800 300 L800 450 L0 450Z" fill="#000" opacity=".25"/>
    <path d="M80 450 Q300 200 800 120" stroke="#e9d8a6" stroke-opacity=".35" stroke-width="40" fill="none"/>
    <circle cx="300" cy="230" r="26" fill="${c}"/><circle cx="470" cy="180" r="22" fill="#ef4444" opacity=".9"/><circle cx="520" cy="240" r="18" fill="#ef4444" opacity=".8"/>
    <rect x="270" y="190" width="60" height="7" rx="3" fill="#000" opacity=".5"/><rect x="270" y="190" width="45" height="7" rx="3" fill="#4ade80"/>
    <rect x="640" y="250" width="140" height="140" rx="8" fill="#000" opacity=".55" stroke="#fff" stroke-opacity=".3"/><path d="M650 380 L770 260" stroke="#e9d8a6" stroke-opacity=".5" stroke-width="6"/>
    <g font-family="Arial" font-weight="700" fill="#fff"><text x="20" y="34" font-size="18">12 / 3 / 7</text><text x="700" y="34" font-size="18">24:51</text></g>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="800" height="450"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><rect width="800" height="450" fill="url(#s)"/>${kind === 'moba' ? moba : fps}</svg>`)}`;
}
const bannerSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 220" width="800" height="220"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#151518"/><stop offset=".6" stop-color="#4A310A"/><stop offset="1" stop-color="#F5B93D"/></linearGradient></defs><rect width="800" height="220" fill="url(#b)"/><g stroke="#F5B93D" stroke-opacity=".35" fill="none" stroke-width="2"><circle cx="640" cy="60" r="80"/><circle cx="640" cy="60" r="130"/><path d="M0 170 Q260 90 800 160"/></g></svg>`)}`;

const people = {
  jin: { name: 'Jin Park', handle: 'jinplays', ini: 'JP', badge: true },
  luna: { name: 'Luna Choi', handle: 'lunaraid', ini: 'LC' },
  theo: { name: 'Theo Han', handle: 'theostream', ini: 'TH', badge: true },
  mina: { name: '미나', handle: 'mina_aim', ini: '미' },
  me: { name: '테스터', handle: 'viewer', ini: '테' },
};
const avatar = (p, size = 40) => `<div class="av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .36)}px">${p.ini}</div>`;
const fmt = n => (n >= 10000 ? (n / 10000).toFixed(1).replace('.0', '') + '만' : n >= 1000 ? n.toLocaleString('ko-KR') : String(n));
const act = (name, n, cls = '', label) => `<button class="act ${cls}" aria-label="${label}">${icon(name, 18, cls === 'on' && name === 'heart' ? 'fill' : '')}${n ? `<span>${fmt(n)}</span>` : ''}</button>`;
function post(p) {
  const u = people[p.who];
  return `<article class="post ${p.video ? 'has-video' : ''}">
    ${p.pinned ? `<div class="ctx">${icon('pin', 14)}고정됨</div>` : p.repost ? `<div class="ctx">${icon('repeat-2', 14)}${esc(p.repost)}님이 리포스트</div>` : ''}
    <header>${avatar(u)}<div class="who"><div class="nm"><b>${esc(u.name)}</b>${u.badge ? `<span class="verified">${icon('badge-check', 15)}</span>` : ''}</div><span class="muted xs">@${u.handle} · ${p.time}</span></div>
      ${p.game ? `<span class="gchip">${icon('gamepad-2', 14)}${esc(p.game)}</span>` : ''}<button class="more" aria-label="더보기">${icon('ellipsis', 18)}</button></header>
    <p>${rich(p.text)}</p>
    ${p.video ? `<div class="video"><img src="${thumb(p.video.kind, p.video.seed)}" alt=""><div class="play">${icon('play', 24, 'fill')}</div>
      <div class="vbar"><span class="dur">${icon('play', 11, 'fill')}${p.video.dur}</span>${p.video.hd ? '<span class="q">1080p60</span>' : ''}<span class="views">${icon('eye', 13)}${fmt(p.v)}</span></div></div>` : ''}
    <footer>${act('heart', p.l, p.liked ? 'on' : '', '좋아요')}${act('message-circle', p.c, '', '댓글')}${act('repeat-2', p.r, '', '리포스트')}<span class="spacer"></span>${act('bookmark', 0, p.saved ? 'on' : '', '북마크')}${act('share', 0, '', '공유')}</footer>
  </article>`;
}
const feedPosts = [
  { who: 'jin', time: '2시간 전', game: '발로란트', text: '1대4 클러치 잡았습니다. 마지막 스파이크 해체 타이밍 꼭 보세요 #클러치 #발로란트', video: { kind: 'fps', seed: 0, dur: '0:48', hd: true }, c: 41, r: 18, l: 324, v: 12400, liked: true },
  { who: 'luna', time: '4시간 전', text: '이번 주 레이드 공대원 2명 구합니다. 평일 저녁 9시, 디스코드 필수. 처음이셔도 차근차근 알려드려요 #공대모집', c: 12, r: 0, l: 27 },
  { who: 'theo', time: '6시간 전', game: '리그 오브 레전드', text: '바론 스틸 각 재는 법 정리했어요. 스마이트 데미지 계산은 1:20부터 @jinplays', video: { kind: 'moba', seed: 1, dur: '2:13', hd: true }, c: 63, r: 40, l: 812, v: 8402, saved: true },
  { who: 'mina', time: '8시간 전', repost: 'Luna Choi', game: '배틀그라운드', text: '자기장 끝에서 마지막 1명 남기고 치킨. 손 떨려서 녹화 끄는 것도 까먹음', video: { kind: 'fps', seed: 2, dur: '1:05' }, c: 8, r: 3, l: 96, v: 2210 },
];
const profilePosts = [
  { ...feedPosts[0], pinned: true },
  { who: 'jin', time: '1일 전', game: '발로란트', text: '에임 루틴 공유합니다. 데스매치 2판 → 레인지 봇 100킬 → 크로스헤어 배치 연습 10분 #에임연습', video: { kind: 'fps', seed: 3, dur: '3:42', hd: true }, c: 22, r: 51, l: 540, v: 9900 },
  { who: 'jin', time: '2일 전', text: '이번 주 토요일 오후 2시에 무료 VOD 리뷰 방송합니다. 리뷰 받고 싶은 클립 답글로 남겨주세요', c: 87, r: 12, l: 203 },
];

// ---------- 셸
const menu = [['house', '홈', 'home'], ['bookmark', '북마크', 'bm'], ['message-square', '메시지', 'dm', 2], ['book-open', '멘토링', 'mentor'], ['user', '프로필', 'profile'], ['wallet-cards', '내 지갑', 'wallet']];
const games = [['V', '발로란트', '#FDE08A'], ['L', '리그 오브 레전드', '#D4D4D8'], ['P', '배틀그라운드', '#FEF0C7']];
const header = `<header class="top">
  <a class="logo"><span class="mark">G</span><span class="word">GamerIN</span></a>
  <label class="search">${icon('search', 18)}<span>게임, 플레이어, 클립 검색</span><kbd>/</kbd></label>
  <div class="hright">
    <button class="btn secondary sm">${icon('clapperboard', 18)}<span>클립 올리기</span></button>
    <button class="iconbtn" aria-label="알림">${icon('bell', 20)}<span class="badge">3</span></button>
  </div>
  <div class="mright"><button class="iconbtn" aria-label="클립 올리기">${icon('clapperboard', 22)}</button><button class="iconbtn" aria-label="알림">${icon('bell', 22)}<span class="badge">3</span></button></div>
</header>`;
const sidebar = active => `<aside class="side">
  <nav>${menu.map(([i, l, k, n]) => `<a class="nav ${k === active ? 'on' : ''}">${icon(i, 20)}<span>${l}</span>${n ? `<span class="count">${n}</span>` : ''}</a>`).join('')}</nav>
  <div class="sect"><span class="label">내 게임</span>${games.map(([g, n, bg]) => `<a class="game"><span class="gico" style="background:${bg}">${g}</span>${n}</a>`).join('')}<a class="game add">${icon('plus', 16)}게임 추가</a></div>
  <div class="acct">${avatar(people.me, 36)}<div class="who"><b>테스터</b><span class="muted xs">다이아 II</span></div><button class="iconbtn sm" aria-label="로그아웃">${icon('log-out', 18)}</button></div>
</aside>`;
const tabbar = active => `<nav class="tabbar">${[['house', '홈', 'home'], ['bookmark', '북마크', 'bm'], ['message-square', '메시지', 'dm'], ['book-open', '멘토링', 'mentor'], ['user', '프로필', 'profile']].map(([i, l, k]) => `<a class="${k === active ? 'on' : ''}">${icon(i, 22)}<span>${l}</span></a>`).join('')}</nav>`;
const page = (title, active, center, rail) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${readFileSync(DIR + 'style2.css', 'utf8')}</style></head>
<body>${header}<div class="shell">${sidebar(active)}<main class="main">${center}</main><aside class="rail">${rail}</aside></div>${tabbar(active)}</body></html>`;

const seg = (items, on = 0) => `<div class="seg">${items.map((t, i) => `<a class="${i === on ? 'on' : ''}">${t}</a>`).join('')}</div>`;
const tags = ['#클러치', '#바론스틸', '#신규시즌', '#에임연습', '#공대모집', '#치킨', '#VOD리뷰'];
const rankClips = `<section class="panel"><div class="ph"><h2>${icon('flame', 18, 'brand')}오늘의 클립</h2><a class="muted xs">더보기</a></div>
  ${[['fps', 2, '0:31', '스나이퍼 노스코프 3킬', '3.1만'], ['moba', 1, '1:12', '펜타킬 직전 역전 한타', '2.4만'], ['fps', 3, '0:54', '원탭 5연속 헤드샷', '1.9만']].map(([k, s, d, t, v], i) => `<div class="rclip"><span class="rank">${i + 1}</span><div class="mini"><img src="${thumb(k, s)}"><span class="dur">${d}</span></div><div class="rc"><b>${t}</b><span class="muted xs">조회수 ${v}회</span></div></div>`).join('')}</section>`;
const tagPanel = `<section class="panel"><div class="ph"><h2>인기 해시태그</h2></div><div class="chips">${tags.map((t, i) => `<a class="chip ${i < 2 ? 'hot' : ''}">${t}</a>`).join('')}</div></section>`;
const recommend = `<section class="panel"><div class="ph"><h2>추천 플레이어</h2></div>${[[people.theo, 'MOBA 크리에이터'], [people.mina, 'FPS · 다이아'], [people.luna, '길드장']].map(([p, d]) => `<div class="rec">${avatar(p, 36)}<div class="who"><b>${esc(p.name)}</b><span class="muted xs">${d}</span></div><button class="btn secondary xs">팔로우</button></div>`).join('')}</section>`;
const foot = `<p class="foot muted xs">이용약관 · 개인정보 처리방침 · © 2026 GamerIN</p>`;

// ---------- 피드
const composer = `<div class="composer">${avatar(people.me, 40)}<div class="fakeinput">무슨 플레이를 공유할까요?</div><button class="tool" aria-label="영상">${icon('video', 20)}</button><button class="tool" aria-label="이미지">${icon('image-plus', 20)}</button></div>`;
const feedCenter = `<div class="feedhead">${seg(['추천', '팔로잉', '클립'])}<span class="muted xs">새 게시물 4개</span></div>${composer}<div class="list">${feedPosts.map(post).join('')}</div>`;
writeFileSync(DIR + 'feed2.html', page('GamerIN 피드 시안 B', 'home', feedCenter, rankClips + tagPanel + recommend + foot));

// ---------- 프로필
const stats = [['주 게임', '발로란트', '다이아 II'], ['K/D', '1.42', '최근 20판'], ['승률', '54%', '시즌 312판'], ['멘토링', '4.9', '리뷰 128개']];
const profileCenter = `<section class="pcard">
  <div class="banner"><img src="${bannerSvg}" alt=""></div>
  <div class="pbody">
    <div class="ptop"><div class="pav">${avatar(people.jin, 96)}</div>
      <div class="pbtns"><button class="iconbtn bordered" aria-label="더보기">${icon('ellipsis', 18)}</button><button class="btn secondary md">${icon('message-square', 18)}<span>메시지</span></button><button class="btn primary md">${icon('plus', 18)}<span>팔로우</span></button></div></div>
    <h1>Jin Park<span class="verified">${icon('badge-check', 20)}</span><span class="chip brand">FPS 코치</span></h1>
    <div class="muted handle">@jinplays · 서울 · <a class="tag">twitch.tv/jinplays</a></div>
    <p class="bio">발로란트 다이아 · FPS 에임 코칭 3년차. 매주 토요일 무료 VOD 리뷰 방송</p>
    <div class="follows"><span><b>1.2만</b> 팔로워</span><span><b>312</b> 팔로잉</span><span><b>1,284</b> 게시물</span><span class="known">${avatar(people.luna, 22)}${avatar(people.theo, 22)}<span class="muted xs">Luna Choi님 외 4명이 팔로우</span></span></div>
    <div class="gcard">${stats.map(([k, v, s]) => `<div class="st"><span class="muted xs">${k}</span><b>${v}</b><span class="muted xs">${s}</span></div>`).join('')}</div>
  </div>
</section>
<div class="feedhead">${seg(['게시물', '클립', '전적', '멘토링'])}</div>
<div class="list">${profilePosts.map(post).join('')}</div>`;
const clipGrid = `<section class="panel"><div class="ph"><h2>대표 클립</h2><a class="muted xs">전체 보기</a></div><div class="grid">${[['fps', 0, '0:48'], ['fps', 3, '3:42'], ['moba', 1, '2:13'], ['fps', 2, '1:05']].map(([k, s, d]) => `<div class="g"><img src="${thumb(k, s)}"><span class="dur">${d}</span></div>`).join('')}</div></section>`;
const program = `<section class="panel"><div class="ph"><h2>멘토링 프로그램</h2></div><div class="prog"><span class="chip">발로란트</span><b>랭크 에임 1:1 코칭</b><span class="muted xs">주말 오후 · 60분 · ${icon('star', 13, 'fill brand')} 4.9 (128)</span><div class="pfoot"><b>10,000 <span class="muted xs">마일리지</span></b><button class="btn secondary xs">자세히</button></div></div></section>`;
writeFileSync(DIR + 'profile2.html', page('Jin Park 프로필 시안 B', 'profile', profileCenter, clipGrid + program + recommend + foot));
console.log('built');
