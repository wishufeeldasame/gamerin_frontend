// 시안 D: 다크 + Volt 포인트, 날 선 형태의 e스포츠 감성 (레이아웃은 시안 C)
import { readFileSync, writeFileSync } from 'node:fs';
import { thumb } from './shared.mjs';
const DIR = new URL('.', import.meta.url).pathname;
const IC = JSON.parse(readFileSync(DIR + 'icons.json', 'utf8'));
const icon = (n, size = 20, extra = '') => `<svg class="ic ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">${IC[n]}</svg>`;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const rich = s => esc(s).replace(/(#[^\s#]+)/g, '<a class="tag">$1</a>');
const fmt = n => (n >= 10000 ? (n / 10000).toFixed(1).replace('.0', '') + '만' : n >= 1000 ? n.toLocaleString('ko-KR') : String(n));
const banner = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 220" width="800" height="220"><rect width="800" height="220" fill="#101317"/><g stroke="#C3F53C" stroke-opacity=".07">${Array.from({ length: 40 }, (_, i) => `<line x1="${i * 40 - 200}" y1="220" x2="${i * 40}" y2="0"/>`).join('')}</g><path d="M520 0 L800 0 L800 220 L430 220 Z" fill="#C3F53C" opacity=".06"/><path d="M600 0 L612 0 L452 220 L440 220 Z" fill="#C3F53C" opacity=".55"/></svg>`)}`;

const people = {
  jin: { name: 'Jin Park', handle: 'jinplays', ini: 'JP', tier: 'DIAMOND 2', game: 'VAL' },
  luna: { name: 'Luna Choi', handle: 'lunaraid', ini: 'LC', tier: 'PLATINUM 1', game: 'LOL' },
  theo: { name: 'Theo Han', handle: 'theostream', ini: 'TH', tier: 'MASTER', game: 'LOL' },
  mina: { name: '미나', handle: 'mina_aim', ini: '미', tier: 'ASCENDANT 1', game: 'VAL' },
  me: { name: '테스터', handle: 'viewer', ini: '테', tier: 'UNRANKED' },
};
const avatar = (p, size = 40) => `<div class="av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .32)}px">${p.ini}</div>`;
const act = (name, n, on, label) => `<button class="act ${on ? 'on' : ''}" aria-label="${label}">${icon(name, 17, on && name === 'heart' ? 'fill' : '')}${n ? `<span>${fmt(n)}</span>` : ''}</button>`;
const tier = t => `<span class="tier">${t}</span>`;

function post(p) {
  const u = people[p.who];
  return `<article class="card post">
    ${p.pinned ? `<div class="ctx">${icon('pin', 13)}PINNED</div>` : ''}
    <header>${avatar(u)}<div class="meta"><div class="nm"><b>${esc(u.name)}</b>${tier(u.tier)}</div><span class="sub">@${u.handle} · ${p.time}</span></div>
      ${p.game ? `<span class="gtag">${p.game}</span>` : ''}<button class="more" aria-label="더보기">${icon('ellipsis', 18)}</button></header>
    <p>${rich(p.text)}</p>
    ${p.video ? `<div class="media"><img src="${thumb(p.video.kind, p.video.seed)}" alt=""><div class="play">${icon('play', 20, 'fill')}</div><span class="dur">${p.video.dur}</span></div>
      ${p.match ? `<div class="match"><span class="res ${p.match.win ? 'w' : 'l'}">${p.match.win ? 'WIN' : 'LOSS'}</span>${p.match.items.map(([k, v]) => `<span><em>${k}</em>${v}</span>`).join('')}</div>` : ''}` : ''}
    <footer>${act('heart', p.l, p.liked, '좋아요')}${act('message-circle', p.c, false, '댓글')}${act('repeat-2', p.r, false, '리포스트')}${p.v ? `<span class="views">${icon('eye', 16)}${fmt(p.v)}</span>` : ''}<span class="spacer"></span>${act('bookmark', 0, p.saved, '북마크')}${act('share', 0, false, '공유')}</footer>
  </article>`;
}
const feedPosts = [
  { who: 'jin', time: '2시간 전', game: 'VALORANT · 경쟁전', text: '1대4 클러치 잡았습니다. 마지막 스파이크 해체 타이밍 꼭 보세요\n#클러치 #발로란트', video: { kind: 'fps', seed: 0, dur: '0:48' }, match: { win: true, items: [['MAP', '어센트'], ['SCORE', '13 : 11'], ['K/D/A', '24/12/5'], ['ACS', '312']] }, c: 41, r: 18, l: 324, v: 12400, liked: true },
  { who: 'luna', time: '4시간 전', text: '이번 주 레이드 공대원 2명 구합니다. 평일 저녁 9시, 디스코드 필수입니다. 처음이셔도 차근차근 알려드려요.\n#공대모집', c: 12, r: 0, l: 27 },
  { who: 'theo', time: '6시간 전', game: 'LEAGUE OF LEGENDS · 솔로 랭크', text: '바론 스틸 각 재는 법 정리했어요. 스마이트 데미지 계산은 1:20부터 보시면 됩니다.', video: { kind: 'moba', seed: 1, dur: '2:13' }, match: { win: false, items: [['TIME', '31:04'], ['K/D/A', '12/3/7'], ['CS', '248'], ['KP', '68%']] }, c: 63, r: 40, l: 812, v: 8402, saved: true },
];
const profilePosts = [{ ...feedPosts[0], pinned: true }, { who: 'jin', time: '2일 전', text: '이번 주 토요일 오후 2시에 무료 VOD 리뷰 방송합니다. 리뷰 받고 싶은 클립 답글로 남겨주세요.', c: 87, r: 12, l: 203 }];

const menu = [['house', '홈', 'home'], ['bookmark', '북마크', 'bm'], ['message-square', '메시지', 'dm'], ['book-open', '멘토링', 'mentor'], ['user', '프로필', 'profile'], ['wallet-cards', '내 지갑', 'wallet']];
const header = `<header class="top"><a class="logo"><span class="mark"></span><span class="word">GAMERIN</span></a>
  <label class="search">${icon('search', 17)}<span>플레이어, 게임, 게시글 검색</span></label>
  <button class="bell" aria-label="알림">${icon('bell', 20)}<span class="dot"></span></button></header>`;
const sidebar = active => `<aside class="side"><nav>${menu.map(([i, l, k]) => `<a class="nav ${k === active ? 'on' : ''}">${icon(i, 19)}<span>${l}</span></a>`).join('')}</nav>
  <div class="acct">${avatar(people.me, 32)}<div class="meta"><b>테스터</b><span class="sub">UNRANKED</span></div><button class="ghost" aria-label="로그아웃">${icon('log-out', 17)}</button></div></aside>`;
const tabbar = active => `<nav class="tabbar">${menu.slice(0, 5).map(([i, l, k]) => `<a class="${k === active ? 'on' : ''}">${icon(i, 21)}<span>${l}</span></a>`).join('')}</nav>`;
const suggest = `<section class="card panel"><h2>추천 플레이어</h2>${[[people.theo, 58], [people.mina, 61], [people.luna, 52]].map(([p, wr]) => `<div class="row">${avatar(p, 36)}<div class="meta"><b>${esc(p.name)}</b><span class="sub">${p.tier} · <span class="wr">승률 ${wr}%</span></span></div><button class="btn outline sm">팔로우</button></div>`).join('')}</section>
  <p class="foot">이용약관 · 개인정보처리방침 · © 2026 GamerIN</p>`;
const tabs = (items, on = 0) => `<div class="tabs">${items.map((t, i) => `<a class="${i === on ? 'on' : ''}">${t}</a>`).join('')}</div>`;
const page = (title, active, center) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${readFileSync(DIR + 'style4.css', 'utf8')}</style></head>
<body>${header}<div class="body">${sidebar(active)}<main class="main"><div class="feed">${center}</div><aside class="rail">${suggest}</aside></main></div>${tabbar(active)}</body></html>`;

const composer = `<section class="card composer"><div class="crow">${avatar(people.me)}<span class="ph">오늘의 플레이를 공유해 보세요</span></div>
  <div class="cbar">${['video', 'image-plus', 'hash'].map(i => `<button class="ghost">${icon(i, 19)}</button>`).join('')}<span class="spacer"></span><button class="btn primary sm" disabled>게시하기</button></div></section>`;
writeFileSync(DIR + 'feed4.html', page('GamerIN 시안 D 피드', 'home', tabs(['추천', '팔로잉']) + composer + feedPosts.map(post).join('')));

const recent = 'WWLWWWLWLWWWLLWWWLWW'.split('');
const profile = `<section class="card pcard"><div class="banner"><img src="${banner}" alt=""></div>
  <div class="pbody">
    <div class="ptop"><div class="pav">${avatar(people.jin, 84)}</div><div class="pbtns"><button class="btn outline md">메시지</button><button class="btn primary md">팔로우</button></div></div>
    <div class="pname"><h1>Jin Park</h1>${tier('FPS COACH')}</div>
    <span class="sub">@jinplays · 서울 · <a class="tag">twitch.tv/jinplays</a></span>
    <p class="bio">발로란트 다이아 · FPS 에임 코칭 3년차. 매주 토요일 무료 VOD 리뷰 방송.</p>
    <div class="counts"><span><b>1.2만</b> 팔로워</span><span><b>312</b> 팔로잉</span><span><b>1,284</b> 게시물</span></div>
  </div>
  <div class="statbar">
    <div class="rank"><span class="glabel">VALORANT · 경쟁전</span><b class="big">DIAMOND 2</b><span class="sub">시즌 312게임</span></div>
    <div class="st"><span class="glabel">승률</span><b>54%</b><div class="wbar"><i style="width:54%"></i></div></div>
    <div class="st"><span class="glabel">K/D</span><b>1.42</b><span class="sub">상위 8%</span></div>
    <div class="st"><span class="glabel">헤드샷</span><b>27.3%</b><span class="sub">평균 ACS 241</span></div>
    <div class="recent"><span class="glabel">최근 20게임 <em>14승 6패</em></span><div class="strip">${recent.map(r => `<i class="${r === 'W' ? 'w' : 'l'}"></i>`).join('')}</div></div>
  </div></section>
  ${tabs(['게시물', '전적', '멘토링'])}${profilePosts.map(post).join('')}`;
writeFileSync(DIR + 'profile4.html', page('Jin Park 시안 D 프로필', 'profile', profile));
console.log('built');
