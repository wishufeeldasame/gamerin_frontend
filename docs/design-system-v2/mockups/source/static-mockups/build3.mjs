// 시안 C: Figma v2(어제 시안)의 구성으로 되돌린 정돈된 버전
import { readFileSync, writeFileSync } from 'node:fs';
import { thumb, bannerSvg } from './shared.mjs';
const DIR = new URL('.', import.meta.url).pathname;
const IC = JSON.parse(readFileSync(DIR + 'icons.json', 'utf8'));
const icon = (n, size = 20, extra = '') => `<svg class="ic ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[n]}</svg>`;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const rich = s => esc(s).replace(/(#[^\s#]+)/g, '<a class="tag">$1</a>').replace(/(@[a-z0-9_]+)/g, '<a class="tag">$1</a>');
const fmt = n => (n >= 10000 ? (n / 10000).toFixed(1).replace('.0', '') + '만' : n >= 1000 ? n.toLocaleString('ko-KR') : String(n));

const people = {
  jin: { name: 'Jin Park', handle: 'jinplays', ini: 'JP', tier: '다이아 II' },
  luna: { name: 'Luna Choi', handle: 'lunaraid', ini: 'LC', tier: '길드장' },
  theo: { name: 'Theo Han', handle: 'theostream', ini: 'TH', tier: '마스터' },
  mina: { name: '미나', handle: 'mina_aim', ini: '미' },
  me: { name: '테스터', handle: 'viewer', ini: '테' },
};
const avatar = (p, size = 40) => `<div class="av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .34)}px">${p.ini}</div>`;
const act = (name, n, on, label) => `<button class="act ${on ? 'on' : ''}" aria-label="${label}">${icon(name, 18, on && name === 'heart' ? 'fill' : '')}${n ? `<span>${fmt(n)}</span>` : ''}</button>`;

function post(p) {
  const u = people[p.who];
  return `<article class="card post">
    ${p.pinned ? `<div class="ctx">${icon('pin', 14)}고정된 게시물</div>` : ''}
    <header>${avatar(u)}<div class="meta"><div class="nm"><b>${esc(u.name)}</b>${u.tier ? `<span class="chip">${u.tier}</span>` : ''}</div>
      <span class="sub">@${u.handle} · ${p.time}${p.game ? ` · ${esc(p.game)}` : ''}</span></div>
      <button class="more" aria-label="더보기">${icon('ellipsis', 18)}</button></header>
    <p>${rich(p.text)}</p>
    ${p.video ? `<div class="media"><img src="${thumb(p.video.kind, p.video.seed)}" alt=""><div class="play">${icon('play', 22, 'fill')}</div><span class="dur">${p.video.dur}</span></div>` : ''}
    <footer>${act('heart', p.l, p.liked, '좋아요')}${act('message-circle', p.c, false, '댓글')}${act('repeat-2', p.r, false, '리포스트')}${p.v ? `<span class="views">${icon('eye', 16)}${fmt(p.v)}</span>` : ''}<span class="spacer"></span>${act('bookmark', 0, p.saved, '북마크')}${act('share', 0, false, '공유')}</footer>
  </article>`;
}
const feedPosts = [
  { who: 'jin', time: '2시간 전', game: '발로란트', text: '1대4 클러치 잡았습니다. 마지막 스파이크 해체 타이밍 꼭 보세요\n#클러치 #발로란트', video: { kind: 'fps', seed: 0, dur: '0:48' }, c: 41, r: 18, l: 324, v: 12400, liked: true },
  { who: 'luna', time: '4시간 전', text: '이번 주 레이드 공대원 2명 구합니다. 평일 저녁 9시, 디스코드 필수입니다. 처음이셔도 차근차근 알려드려요.\n#공대모집', c: 12, r: 0, l: 27 },
  { who: 'theo', time: '6시간 전', game: '리그 오브 레전드', text: '바론 스틸 각 재는 법 정리했어요. 스마이트 데미지 계산은 1:20부터 보시면 됩니다.', video: { kind: 'moba', seed: 1, dur: '2:13' }, c: 63, r: 40, l: 812, v: 8402, saved: true },
];
const profilePosts = [
  { ...feedPosts[0], pinned: true },
  { who: 'jin', time: '2일 전', text: '이번 주 토요일 오후 2시에 무료 VOD 리뷰 방송합니다. 리뷰 받고 싶은 클립 답글로 남겨주세요.', c: 87, r: 12, l: 203 },
  { who: 'jin', time: '3일 전', game: '발로란트', text: '에임 루틴 공유합니다. 데스매치 2판, 레인지 봇 100킬, 크로스헤어 배치 연습 10분.\n#에임연습', video: { kind: 'fps', seed: 3, dur: '3:42' }, c: 22, r: 51, l: 540, v: 9900 },
];

const menu = [['house', '홈', 'home'], ['bookmark', '북마크', 'bm'], ['message-square', '메시지', 'dm'], ['book-open', '멘토링', 'mentor'], ['user', '프로필', 'profile'], ['wallet-cards', '내 지갑', 'wallet']];
const header = `<header class="top"><a class="logo"><span class="mark">G</span><span class="word">GamerIN</span></a>
  <label class="search">${icon('search', 18)}<span>게임, 플레이어, 게시글 검색</span></label>
  <button class="bell" aria-label="알림">${icon('bell', 20)}<span class="dot"></span></button></header>`;
const sidebar = active => `<aside class="side"><nav>${menu.map(([i, l, k]) => `<a class="nav ${k === active ? 'on' : ''}">${icon(i, 20)}<span>${l}</span></a>`).join('')}</nav>
  <div class="acct">${avatar(people.me, 32)}<div class="meta"><b>테스터</b><span class="sub">다이아 II</span></div><button class="ghost" aria-label="로그아웃">${icon('log-out', 18)}</button></div></aside>`;
const tabbar = active => `<nav class="tabbar">${menu.slice(0, 5).map(([i, l, k]) => `<a class="${k === active ? 'on' : ''}">${icon(i, 22)}<span>${l}</span></a>`).join('')}</nav>`;
const suggest = `<section class="card panel"><h2>추천 플레이어</h2>${[people.theo, people.mina, people.luna].map(p => `<div class="row">${avatar(p, 40)}<div class="meta"><b>${esc(p.name)}</b><span class="sub">@${p.handle}</span></div><button class="btn secondary sm">팔로우</button></div>`).join('')}</section>
  <p class="foot">이용약관 · 개인정보처리방침 · © 2026 GamerIN</p>`;
const tabs = (items, on = 0) => `<div class="tabs">${items.map((t, i) => `<a class="${i === on ? 'on' : ''}">${t}</a>`).join('')}</div>`;
const page = (title, active, center) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${readFileSync(DIR + 'style3.css', 'utf8')}</style></head>
<body>${header}<div class="body">${sidebar(active)}<main class="main"><div class="feed">${center}</div><aside class="rail">${suggest}</aside></main></div>${tabbar(active)}</body></html>`;

const composer = `<section class="card composer"><div class="crow">${avatar(people.me)}<span class="ph">무슨 생각을 하고 있나요?</span></div>
  <div class="cbar">${['video', 'image-plus', 'hash'].map(i => `<button class="ghost">${icon(i, 20)}</button>`).join('')}<span class="spacer"></span><button class="btn primary sm" disabled>게시하기</button></div></section>`;
writeFileSync(DIR + 'feed3.html', page('GamerIN 피드 시안 C', 'home', tabs(['추천', '팔로잉']) + composer + feedPosts.map(post).join('')));

const profile = `<section class="card pcard"><div class="banner"><img src="${bannerSvg}" alt=""></div>
  <div class="pbody"><div class="ptop"><div class="pav">${avatar(people.jin, 88)}</div><div class="pbtns"><button class="btn secondary md">메시지</button><button class="btn primary md">팔로우</button></div></div>
    <h1>Jin Park <span class="chip brand">FPS 코치</span></h1><span class="sub">@jinplays</span>
    <p class="bio">발로란트 다이아 · FPS 에임 코칭 3년차. 매주 토요일 무료 VOD 리뷰 방송.</p>
    <div class="facts"><span>${icon('gamepad-2', 16)}발로란트 다이아 II</span><span>${icon('map-pin', 16)}서울</span><span>${icon('link', 16)}<a class="tag">twitch.tv/jinplays</a></span></div>
    <div class="counts"><span><b>1.2만</b> 팔로워</span><span><b>312</b> 팔로잉</span><span><b>1,284</b> 게시물</span></div></div></section>
  ${tabs(['게시물', '전적', '멘토링'])}${profilePosts.map(post).join('')}`;
writeFileSync(DIR + 'profile3.html', page('Jin Park 프로필 시안 C', 'profile', profile));
console.log('built');
