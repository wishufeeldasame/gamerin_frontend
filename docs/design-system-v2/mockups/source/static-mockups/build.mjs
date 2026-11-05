// GamerIN v2 Twitter형 레이아웃 정적 목업 생성기
import { readFileSync, writeFileSync } from 'node:fs';
const DIR = new URL('.', import.meta.url).pathname;
const IC = JSON.parse(readFileSync(DIR + 'icons.json', 'utf8'));
const icon = (n, size = 20, extra = '') => `<svg class="ic ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[n]}</svg>`;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const rich = s => esc(s).replace(/(#[^\s#]+)/g, '<a class="tag">$1</a>').replace(/(@[a-z0-9_]+)/g, '<a class="tag">$1</a>');

// ---------- 게임 화면풍 썸네일 (범용 HUD 일러스트)
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
    <g font-family="Arial" font-weight="700" fill="#fff"><text x="660" y="40" font-size="14" opacity=".85">Nova  >  Rook</text><text x="660" y="62" font-size="14" opacity=".85">Nova  >  Ash</text>
    <text x="30" y="318" font-size="30">100</text><text x="680" y="318" font-size="30">24<tspan font-size="18" opacity=".7"> / 90</tspan></text></g>
    <rect x="95" y="298" width="160" height="10" rx="5" fill="#fff" opacity=".25"/><rect x="95" y="298" width="130" height="10" rx="5" fill="#4ade80"/>`;
  const moba = `
    <rect width="800" height="450" fill="${b}"/><path d="M0 330 Q200 280 400 320 T800 300 L800 450 L0 450Z" fill="#000" opacity=".25"/>
    <path d="M80 450 Q300 200 800 120" stroke="#e9d8a6" stroke-opacity=".35" stroke-width="40" fill="none"/>
    <circle cx="300" cy="230" r="26" fill="${c}"/><circle cx="470" cy="180" r="22" fill="#ef4444" opacity=".9"/><circle cx="520" cy="240" r="18" fill="#ef4444" opacity=".8"/>
    <rect x="270" y="190" width="60" height="7" rx="3" fill="#000" opacity=".5"/><rect x="270" y="190" width="45" height="7" rx="3" fill="#4ade80"/>
    <rect x="640" y="290" width="145" height="145" rx="8" fill="#000" opacity=".55" stroke="#fff" stroke-opacity=".3"/><path d="M650 425 L775 300" stroke="#e9d8a6" stroke-opacity=".5" stroke-width="6"/>
    <rect x="230" y="395" width="340" height="44" rx="8" fill="#000" opacity=".55"/>${[0, 1, 2, 3].map(i => `<rect x="${245 + i * 50}" y="402" width="38" height="30" rx="6" fill="#fff" opacity="${i === 3 ? .15 : .35}"/>`).join('')}
    <g font-family="Arial" font-weight="700" fill="#fff"><text x="20" y="34" font-size="18">12 / 3 / 7</text><text x="700" y="34" font-size="18">24:51</text></g>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="800" height="450"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><rect width="800" height="450" fill="url(#s)"/>${kind === 'moba' ? moba : fps}</svg>`)}`;
}
const bannerSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" width="600" height="200"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#151518"/><stop offset=".6" stop-color="#4A310A"/><stop offset="1" stop-color="#F5B93D"/></linearGradient></defs><rect width="600" height="200" fill="url(#b)"/><g stroke="#F5B93D" stroke-opacity=".35" fill="none" stroke-width="2"><circle cx="470" cy="60" r="70"/><circle cx="470" cy="60" r="110"/><path d="M0 160 Q200 90 600 150"/></g></svg>`)}`;

// ---------- 데이터
const people = {
  jin: { name: 'Jin Park', handle: 'jinplays', ini: 'JP', badge: true },
  luna: { name: 'Luna Choi', handle: 'lunaraid', ini: 'LC' },
  theo: { name: 'Theo Han', handle: 'theostream', ini: 'TH', badge: true },
  mina: { name: '미나', handle: 'mina_aim', ini: '미' },
};
const avatar = (p, size = 40) => `<div class="av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .36)}px">${p.ini}</div>`;
const fmt = n => (n >= 10000 ? (n / 10000).toFixed(1).replace('.0', '') + '만' : n >= 1000 ? n.toLocaleString('ko-KR') : String(n));
const act = (name, n, cls = '', label) => `<button class="act ${cls}" aria-label="${label}">${icon(name, 18, cls === 'on' && name === 'heart' ? 'fill' : '')}${n ? `<span>${fmt(n)}</span>` : ''}</button>`;
function post(p) {
  const u = people[p.who];
  const media = p.video ? `
    <div class="video">
      <img src="${thumb(p.video.kind, p.video.seed)}" alt="">
      <div class="play">${icon('play', 26, 'fill')}</div>
      <span class="dur">${p.video.dur}</span>
      ${p.video.hd ? '<span class="q">1080p60</span>' : ''}
    </div>` : '';
  return `<article class="post">
    ${p.pinned ? `<div class="ctx">${icon('pin', 14)}고정된 게시물</div>` : p.repost ? `<div class="ctx">${icon('repeat-2', 14)}${esc(p.repost)}님이 리포스트함</div>` : ''}
    <div class="row">${avatar(u)}
      <div class="body">
        <header><b>${esc(u.name)}</b>${u.badge ? `<span class="verified">${icon('badge-check', 16)}</span>` : ''}<span class="muted">@${u.handle} · ${p.time}</span><button class="more" aria-label="더보기">${icon('ellipsis', 18)}</button></header>
        ${p.game ? `<div class="game">${icon('gamepad-2', 14)}${esc(p.game)}</div>` : ''}
        <p>${rich(p.text)}</p>
        ${media}
        <footer>
          ${act('message-circle', p.c, '', '댓글')}${act('repeat-2', p.r, p.reposted ? 'on-g' : '', '리포스트')}${act('heart', p.l, p.liked ? 'on' : '', '좋아요')}${act('chart-no-axes-column', p.v, '', '조회수')}
          <span class="spacer"></span>${act('bookmark', 0, p.saved ? 'on' : '', '북마크')}${act('share', 0, '', '공유')}
        </footer>
      </div></div></article>`;
}
const feedPosts = [
  { who: 'jin', time: '2시간', game: '발로란트 · 경쟁전', text: '1대4 클러치 잡았습니다. 마지막 스파이크 해체 타이밍 꼭 보세요 #클러치 #발로란트', video: { kind: 'fps', seed: 0, dur: '0:48', hd: true }, c: 41, r: 18, l: 324, v: 12400, liked: true },
  { who: 'luna', time: '4시간', text: '이번 주 레이드 공대원 2명 구합니다. 평일 저녁 9시, 디스코드 필수. 처음이셔도 차근차근 알려드려요 #공대모집', c: 12, r: 0, l: 27, v: 1830 },
  { who: 'theo', time: '6시간', game: '리그 오브 레전드 · 솔로 랭크', text: '바론 스틸 각 재는 법 정리했어요. 스마이트 데미지 계산은 영상 1:20부터 @jinplays', video: { kind: 'moba', seed: 1, dur: '2:13', hd: true }, c: 63, r: 40, l: 812, v: 8402, saved: true },
  { who: 'mina', time: '8시간', repost: 'Luna Choi', game: '배틀그라운드 · 스쿼드', text: '자기장 끝에서 마지막 1명 남기고 치킨. 손 떨려서 녹화 끄는 것도 까먹음', video: { kind: 'fps', seed: 2, dur: '1:05' }, c: 8, r: 3, l: 96, v: 2210 },
  { who: 'luna', time: '10시간', text: '테스트123', c: 0, r: 0, l: 0, v: 41 },
];
const profilePosts = [
  { ...feedPosts[0], pinned: true },
  { who: 'jin', time: '1일', game: '발로란트 · 연습', text: '에임 루틴 공유합니다. 데스매치 2판 → 레인지 봇 100킬 → 크로스헤어 배치 연습 10분. 멘토링에서 자세히 알려드려요 #에임연습', video: { kind: 'fps', seed: 3, dur: '3:42', hd: true }, c: 22, r: 51, l: 540, v: 9900 },
  { who: 'jin', time: '2일', text: '이번 주 토요일 오후 2시에 무료 VOD 리뷰 방송합니다. 리뷰 받고 싶은 클립 답글로 남겨주세요', c: 87, r: 12, l: 203, v: 5400 },
];

// ---------- 공통 레이아웃
const nav = active => [['house', '홈', 'home'], ['search', '탐색', 'explore'], ['bell', '알림', 'noti', 3], ['message-square', '메시지', 'dm'], ['book-open', '멘토링', 'mentor'], ['bookmark', '북마크', 'bm'], ['wallet-cards', '지갑', 'wallet'], ['user', '프로필', 'profile']]
  .map(([i, l, k, badge]) => `<a class="nav ${k === active ? 'on' : ''}">${icon(i, 24)}${badge ? `<span class="dot">${badge}</span>` : ''}<span>${l}</span></a>`).join('');
const tabbar = active => [['house', 'home'], ['search', 'explore'], ['book-open', 'mentor'], ['bell', 'noti'], ['message-square', 'dm']]
  .map(([i, k]) => `<a class="${k === active ? 'on' : ''}">${icon(i, 24)}${k === 'noti' ? '<span class="dot sm"></span>' : ''}</a>`).join('');
const left = active => `<aside class="left">
  <a class="logo"><span class="mark">G</span><span class="word">GamerIN</span></a>
  <nav>${nav(active)}</nav>
  <button class="btn primary lg">${icon('square-pen', 20)}<span>게시하기</span></button>
  <div class="me">${avatar({ ini: '테' }, 40)}<div><b>테스터</b><span class="muted">@viewer</span></div>${icon('ellipsis', 18, 'muted')}</div>
</aside>`;
const trends = [['발로란트 · 트렌드', '#클러치', '2,341'], ['리그 오브 레전드', '#바론스틸', '1,108'], ['게임 · 실시간', '#신규시즌', '6,920'], ['멘토링', '#에임연습', '842']];
const right = extra => `<aside class="right">
  <label class="search">${icon('search', 18)}<span>게임, 플레이어, 클립 검색</span></label>
  ${extra}
  <section class="panel"><h2>지금 뜨는 해시태그</h2>${trends.map(([c, t, n]) => `<div class="trend"><span class="muted xs">${c}</span><b>${t}</b><span class="muted xs">게시물 ${n}개</span></div>`).join('')}</section>
  <section class="panel"><h2>추천 플레이어</h2>${[people.theo, people.mina, people.luna].map(p => `<div class="who">${avatar(p)}<div><b>${esc(p.name)}</b><span class="muted">@${p.handle}</span></div><button class="btn inverse sm">팔로우</button></div>`).join('')}</section>
  <p class="foot muted xs">이용약관 · 개인정보 처리방침 · © 2026 GamerIN</p>
</aside>`;
const mobileTop = inner => `<div class="mtop">${inner}</div>`;
const page = (title, active, center, rightExtra, mTop) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${readFileSync(DIR + 'style.css', 'utf8')}</style></head>
<body><div class="shell">${left(active)}<main class="center">${mobileTop(mTop)}${center}</main>${right(rightExtra)}</div>
<button class="fab" aria-label="게시하기">${icon('square-pen', 24)}</button><nav class="tabbar">${tabbar(active)}</nav></body></html>`;

// ---------- 피드
const composer = `<div class="composer">${avatar({ ini: '테' })}<div class="cbody"><div class="ph">무슨 플레이를 공유할까요?</div>
  <div class="ctools">${['video', 'image-plus', 'gamepad-2', 'hash', 'smile'].map(i => `<button class="tool">${icon(i, 20)}</button>`).join('')}<span class="spacer"></span><button class="btn primary sm" disabled>게시</button></div></div></div>`;
const feedCenter = `<div class="sticky"><div class="tabs"><a class="on">추천</a><a>팔로잉</a><a>클립</a></div></div>${composer}${feedPosts.map(post).join('')}`;
const liveClips = `<section class="panel"><h2>오늘의 클립</h2>${[['fps', 2, '0:31', '스나이퍼 노스코프 3킬', '3.1만'], ['moba', 1, '1:12', '펜타킬 직전 역전 한타', '2.4만']].map(([k, s, d, t, v]) => `<div class="clip"><div class="mini"><img src="${thumb(k, s)}"><span class="dur">${d}</span></div><div><b class="sm2">${t}</b><span class="muted xs">조회수 ${v}회</span></div></div>`).join('')}</section>`;
writeFileSync(DIR + 'feed.html', page('GamerIN 피드', 'home', feedCenter, liveClips, `${avatar({ ini: '테' }, 32)}<span class="mark sm">G</span>${icon('settings', 22, 'muted')}`));

// ---------- 프로필
const stats = [['발로란트', '다이아 II', '승률 54%'], ['K/D', '1.42', '최근 20판'], ['멘토링', '4.9', '리뷰 128개']];
const profileCenter = `<div class="sticky phead">${icon('arrow-left', 20)}<div><b>Jin Park</b><span class="muted xs">게시물 1,284개</span></div></div>
<div class="banner"><img src="${bannerSvg}" alt=""></div>
<div class="pinfo">
  <div class="pavrow"><div class="pav">${avatar(people.jin, 128)}</div><div class="pbtns"><button class="btn icon">${icon('ellipsis', 18)}</button><button class="btn icon">${icon('mail', 18)}</button><button class="btn inverse md">팔로우</button></div></div>
  <h1>Jin Park<span class="verified">${icon('badge-check', 20)}</span></h1>
  <div class="muted">@jinplays <span class="chip brand">FPS 코치</span></div>
  <p class="bio">발로란트 다이아 · FPS 에임 코칭 3년차. 매주 토요일 무료 VOD 리뷰 방송</p>
  <div class="statrow">${stats.map(([k, v, s]) => `<div class="stat"><span class="muted xs">${k}</span><b>${v}</b><span class="muted xs">${s}</span></div>`).join('')}</div>
  <div class="meta muted">${icon('map-pin', 16)}서울 <span class="lnk">${icon('link', 16)}<a class="tag">twitch.tv/jinplays</a></span> ${icon('calendar-days', 16)}2025년 3월 가입</div>
  <div class="follows"><b>312</b> <span class="muted">팔로잉</span><b>1.2만</b> <span class="muted">팔로워</span></div>
  <div class="known muted xs"><span class="stack">${avatar(people.luna, 20)}${avatar(people.theo, 20)}</span>Luna Choi님, Theo Han님 외 3명이 팔로우합니다</div>
</div>
<div class="tabs ptabs"><a class="on">게시물</a><a>클립</a><a>전적</a><a>멘토링</a><a>좋아요</a></div>
${profilePosts.map(post).join('')}`;
const clipGrid = `<section class="panel"><h2>클립 하이라이트</h2><div class="grid">${[['fps', 0, '0:48'], ['fps', 3, '3:42'], ['moba', 1, '2:13'], ['fps', 2, '1:05'], ['moba', 0, '0:57'], ['fps', 1, '1:30']].map(([k, s, d]) => `<div class="g"><img src="${thumb(k, s)}"><span class="dur">${d}</span></div>`).join('')}</div></section>`;
writeFileSync(DIR + 'profile.html', page('Jin Park 프로필', 'profile', profileCenter, clipGrid, `${icon('arrow-left', 22)}<div class="mt-title"><b>Jin Park</b><span class="muted xs">게시물 1,284개</span></div>${icon('search', 22, 'muted')}`));
console.log('built');
