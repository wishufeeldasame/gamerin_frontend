'use client';

import Image from 'next/image';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  ArrowRight, ArrowUp, BarChart3, Bell, Bookmark, BookOpen, Check, CheckCheck, CheckCircle2, Clock3, Gamepad2, Heart, Home, Image as ImageIcon, LoaderCircle, MapPin,
  MessageCircle, MessageSquare, MoreHorizontal, Paperclip, Plus, RefreshCw, Repeat2, Search, Settings, Smile, SquarePen, Star, Target, Trash2,
  Upload, User, Video, Wallet, X,
} from 'lucide-react';
import { MembershipBadge } from '@/app/home/components/MembershipBadge';
import { MEMBERSHIP_CONTENT } from '@/lib/membership-content';
import { Camera, Collapse, Count, Roll, Stage, Toast, type Act } from '@/components/stageshow';
import type { Rect } from '@/components/stageshow/kit/measure';

// 전시 전용 예시 데이터. 실제 계정·전적·게시물이 아니다.
const ME = { name: '새벽의듀오', handle: 'dawn_duo', initial: '새' };
const MENTOR = { name: '클러치코치', handle: 'clutchcoach', initial: '클' };
const CLIP = { src: '/demo-assets/valorant-highlight.mp4', poster: '/demo-assets/valorant-thumb-2.jpg', file: 'vlrt_movie.mp4' };
const TIER = '/images/tiers/valorant/immortal-3.png';
const POST_TEXT = '오늘의 클러치. 마지막 판단, 어땠나요? #발로란트';
const NOTE_TEXT = '마지막 진입 판단을 배우고 싶어요.';
const MSG_TEXT = '마지막 진입 판단이 궁금해요.';
const CHAPTERS = [
  { label: '전적 연동', title: '게임 전적이\n곧 내 프로필.' },
  { label: '주간 리포트', title: '이번 주 전적은\nAI 리포트로.' },
  { label: '플레이 공유', title: '멋진 플레이는\n피드에서 함께.' },
  { label: '1:1 멘토링', title: '다음 티어는\n멘토와 함께.' },
  { label: '메시지', title: '신청부터 대화까지\n한 곳에서.' },
];

type Screen = 'profile' | 'report' | 'feed' | 'mentoring' | 'messages';
type S = {
  cover: boolean; wipe: number; chapter: number; screen: Screen; zoom: Rect | null; toast: string; toastOn: boolean;
  linkOpen: boolean; riot: string; riotFocus: boolean; linking: boolean; linked: boolean; statsIn: boolean; rep: boolean; reportScrolled: boolean;
  draft: string; drafting: boolean; attached: boolean; posted: boolean; progress: number; playing: boolean; scrolled: boolean; likes: number; burst: number; comments: number;
  applyOpen: boolean; note: string; applied: boolean; accepted: boolean; mileage: number;
  msg: string; msgFocus: boolean; sent: boolean; read: boolean; typing: boolean; replied: boolean;
};
const initial: S = {
  cover: true, wipe: 0, chapter: 0, screen: 'profile', zoom: null, toast: '', toastOn: false,
  linkOpen: false, riot: '', riotFocus: false, linking: false, linked: false, statsIn: false, rep: false, reportScrolled: false,
  draft: '', drafting: false, attached: false, posted: false, progress: 0, playing: false, scrolled: false, likes: 0, burst: 0, comments: 0,
  applyOpen: false, note: '', applied: false, accepted: false, mileage: 50000,
  msg: '', msgFocus: false, sent: false, read: false, typing: false, replied: false,
};
// 모션 줄이기에서 보이는 정지 화면: 게시물에 반응이 달린 순간.
const poster: S = { ...initial, cover: false, chapter: 3, screen: 'feed', linked: true, statsIn: true, rep: true, posted: true, progress: 1, scrolled: true, likes: 28, comments: 2 };

// 카메라가 당겨 잡는 영역(폭 1280 무대 좌표, 내용은 위에서부터 720 안에 놓인다). 레이아웃은 showcase.css 의 고정 치수와 맞춘다.
const Z = {
  name: { x: 264, y: 60, width: 640, height: 230 },
  link: { x: 400, y: 150, width: 480, height: 330 },
  stats: { x: 264, y: 306, width: 640, height: 390 },
  reportStats: { x: 264, y: 119, width: 792, height: 330 },
  reportAi: { x: 264, y: 300, width: 792, height: 345 },
  composer: { x: 264, y: 0, width: 640, height: 330 },
  react: { x: 264, y: 316, width: 640, height: 400 },
  program: { x: 264, y: 120, width: 484, height: 300 },
  apply: { x: 400, y: 100, width: 480, height: 400 },
  mine: { x: 264, y: 120, width: 520, height: 330 },
  thread: { x: 580, y: 230, width: 676, height: 474 },
} satisfies Record<string, Rect>;

// 챕터 카드가 화면을 덮은 사이에 다음 화면으로 바꾼다.
async function cut(a: Act<S>, chapter: number, patch: Partial<S>) {
  await a.set({ wipe: chapter });
  await a.wait(480);
  await a.snap({ ...patch, chapter, zoom: null, toastOn: false });
  await a.wait(1720);
}

async function script(a: Act<S>) {
  await a.wait(1900);

  // 1. 프로필에서 발로란트 전적 연동
  await cut(a, 1, { cover: false });
  a.mark('profile');
  await a.wait(300);
  await a.click('add-stats');
  await a.set({ linkOpen: true });
  await a.wait(350);
  await a.set({ zoom: Z.link });
  await a.wait(800);
  await a.click({ at: 'riot', x: 0.35, y: 0.5 });
  await a.set({ riotFocus: true });
  await a.type('riot', 'Dawn#KR1', { interval: 50 });
  await a.wait(200);
  await a.click('link-go');
  await a.set({ linking: true, riotFocus: false });
  await a.wait(600);
  await a.set({ linkOpen: false, linking: false, zoom: null });
  await a.wait(300);
  a.mark('linked');
  await a.set({ linked: true, zoom: Z.stats });
  await a.wait(600);
  await a.set({ statsIn: true, toast: '발로란트 전적을 연결했어요', toastOn: true });
  await a.wait(1300);
  // 연동이 끝나면 닉네임 옆에 대표 티어가 붙는다.
  await a.set({ zoom: Z.name, toastOn: false });
  await a.wait(900);
  a.mark('rep');
  await a.set({ rep: true, toast: '대표 티어가 Immortal 3로 표시돼요', toastOn: true });
  await a.wait(1500);

  // 2. 멤버십 콘텐츠: 주간 전적 리포트(프리뷰 예시 데이터)
  await cut(a, 2, { screen: 'report' });
  a.mark('report');
  await a.wait(500);
  await a.set({ zoom: Z.reportStats });
  await a.wait(1800);
  await a.set({ zoom: Z.reportAi });
  await a.wait(2000);
  await a.set({ zoom: null, reportScrolled: true });
  await a.wait(1600);

  // 3. 피드에 게임 클립 업로드 → 재생·좋아요·댓글
  await cut(a, 3, { screen: 'feed' });
  a.mark('feed');
  await a.wait(300);
  await a.click({ at: 'composer', x: 0.3, y: 0.5 });
  await a.set({ drafting: true, zoom: Z.composer });
  await a.wait(700);
  await a.type('draft', POST_TEXT, { interval: 28 });
  await a.click('attach');
  await a.set({ attached: true });
  await a.wait(450);
  await a.click('publish');
  await a.set({ drafting: false, attached: false, draft: '', posted: true, zoom: null });
  await a.wait(400);
  await a.set({ progress: 1, scrolled: true });
  await a.wait(1100);
  a.mark('playing');
  await a.set({ playing: true, toast: '업로드 완료', toastOn: true });
  await a.wait(700);
  await a.set({ zoom: Z.react });
  await a.wait(500);
  await a.set({ likes: 9, burst: 1, toastOn: false });
  await a.wait(550);
  await a.set({ likes: 21, burst: 2 });
  await a.wait(500);
  await a.set({ likes: 28, burst: 3, comments: 1 });
  await a.wait(700);
  await a.set({ comments: 2 });
  await a.wait(1100);

  // 4. 멘토링 신청 → 수락
  await cut(a, 4, { screen: 'mentoring', playing: false });
  a.mark('mentoring');
  await a.wait(300);
  await a.set({ zoom: Z.program });
  await a.wait(800);
  await a.click('apply');
  await a.set({ applyOpen: true, zoom: Z.apply });
  await a.wait(700);
  await a.type('note', NOTE_TEXT, { interval: 32 });
  await a.click('apply-go');
  await a.set({ applyOpen: false, applied: true, mileage: 40000, zoom: null });
  await a.wait(900);
  a.mark('accepted');
  await a.set({ accepted: true, zoom: Z.mine });
  await a.wait(1200);
  await a.click('chat-start');

  // 5. 멘토와 메시지
  await cut(a, 5, { screen: 'messages' });
  a.mark('messages');
  await a.wait(300);
  await a.click({ at: 'msg-input', x: 0.3, y: 0.5 });
  await a.set({ msgFocus: true, zoom: Z.thread });
  await a.wait(700);
  await a.type('msg', MSG_TEXT, { interval: 38 });
  await a.click('msg-send');
  await a.set({ sent: true, msg: '', msgFocus: false });
  await a.wait(700);
  await a.set({ read: true, typing: true });
  await a.wait(900);
  a.mark('reply');
  await a.set({ typing: false, replied: true });
  await a.wait(1500);

  // 타이틀로 덮은 뒤 처음 상태로 되돌린다. 다음 반복은 같은 타이틀에서 이어진다.
  a.mark('outro');
  void a.move('rest');
  await a.set({ cover: true, zoom: null });
  await a.wait(800);
  await a.snap(initial);
  await a.wait(300);
}

function Clip({ playing, className }: { playing: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (!playing) { video.pause(); return; }
    video.currentTime = 0;
    void video.play().catch(() => {});
  }, [playing]);
  return <video ref={ref} className={className} src={CLIP.src} poster={CLIP.poster} muted loop playsInline preload="auto" />;
}

const Av = ({ children, size = 40 }: { children: ReactNode; size?: number }) => <span className="sc-av" style={{ width: size, height: size, fontSize: size * 0.36 }}>{children}</span>;
const TierIcon = ({ size = 16 }: { size?: number }) => <Image src={TIER} alt="" width={size} height={size} style={{ width: size, height: size }} unoptimized className="sc-tier" />;
/** 내 닉네임: 멤버십 체크는 항상, 발로란트 대표 티어(Immortal 3)는 전적 연동 뒤부터 붙는다. */
const MyName = ({ size = 15, tier }: { size?: number; tier: boolean }) => <span className="sc-name">{ME.name}<MembershipBadge active size={size} />{tier && <span className="sc-rep"><TierIcon size={size} /></span>}</span>;
const Bars = ({ w }: { w: number[] }) => <>{w.map((width, i) => <span key={i} className="sc-bar" style={{ width }} />)}</>;
const Typed = ({ text, focus, placeholder }: { text: string; focus: boolean; placeholder: string }) => {
  const tag = text.indexOf('#');
  return <span className="sc-typed" data-empty={!text || undefined}>{text ? <>{tag < 0 ? text : <>{text.slice(0, tag)}<em>{text.slice(tag)}</em></>}</> : placeholder}{focus && <i className="sc-caret" />}</span>;
};

const NAV: { icon: typeof Home; label: string; screen?: Screen; badge?: boolean }[] = [
  { icon: Home, label: '홈', screen: 'feed' }, { icon: Search, label: '검색' }, { icon: Bell, label: '알림', badge: true }, { icon: Bookmark, label: '북마크' },
  { icon: MessageSquare, label: '메시지', screen: 'messages' }, { icon: BookOpen, label: '멘토링', screen: 'mentoring' }, { icon: User, label: '프로필', screen: 'profile' },
];

function Sidebar({ s }: { s: S }) {
  return (
    <aside className="sc-side">
      <div className="sc-logo">Gamer<em>IN</em></div>
      <nav>{NAV.map(({ icon: Icon, label, screen, badge }) => <div key={label} className="sc-nav" data-on={screen === s.screen || undefined}><Icon size={18} />{label}{badge && <b>1</b>}</div>)}</nav>
      <div className="sc-usercard">
        <div className="sc-user"><Av size={36}>{ME.initial}</Av><div><MyName size={14} tier={s.rep} /><span className="sc-sub">@{ME.handle}</span></div><MoreHorizontal size={16} /></div>
        <div className="sc-wallet"><Wallet size={16} /><div><span className="sc-sub">마일리지</span><strong><Count value={s.mileage} /></strong></div><em>충전</em></div>
      </div>
    </aside>
  );
}

function Rail({ s }: { s: S }) {
  return (
    <div className="sc-rail">
      <div className="sc-card sc-rail-card">
        <div className="sc-rail-head">{s.rep ? 'VALORANT' : 'PUBG'}<span>{s.rep && <TierIcon size={15} />}{s.rep ? 'Immortal 3' : 'Diamond 1'}</span></div>
        <span className="sc-sub">{s.rep ? 'K/D 1.38 · 승률 62% · 48판' : 'K/D 3.42 · 승률 18% · 42판'}</span>
      </div>
      <h3>추천 친구</h3>
      <div className="sc-card sc-rail-card">
        <div className="sc-friend"><Av size={34}>{MENTOR.initial}</Av><div><strong>{MENTOR.name}</strong><span className="sc-sub">@{MENTOR.handle} · 승률 68%</span></div><button type="button">팔로우</button></div>
        <div className="sc-friend"><Av size={34}> </Av><div><Bars w={[84, 120]} /></div><button type="button">팔로우</button></div>
      </div>
      <p className="sc-legal">이용약관 · 개인정보처리방침 · © 2026 GamerIN</p>
    </div>
  );
}

const Tile = ({ label, children, brand, i = 0 }: { label: string; children: ReactNode; brand?: boolean; i?: number }) => (
  <div className="sc-tile" data-brand={brand || undefined} style={{ ['--i' as string]: i }}><span>{label}</span><strong>{children}</strong></div>
);

function Profile({ s }: { s: S }) {
  return (
    <>
      <div className="sc-col">
        <div className="sc-cover-band" />
        <div className="sc-profile-top"><Av size={76}>{ME.initial}</Av><span className="sc-grow" /><button type="button" className="sc-btn sc-btn-icon"><Settings size={15} /></button><button type="button" className="sc-btn">프로필 수정</button></div>
        <div className="sc-profile-name"><MyName size={19} tier={s.rep} /></div>
        <span className="sc-sub">@{ME.handle}</span>
        <p className="sc-bio">오늘의 플레이를 기록하고, 함께 더 나은 한 판을 만듭니다.</p>
        <div className="sc-follows"><span><MapPin size={12} />대한민국</span><span><b>128</b> 팔로워</span><span><b>86</b> 팔로잉</span><span><b>12</b> 게시글</span></div>
        <div className="sc-tabs"><span>게시글</span><span data-on>전적</span><span>미디어</span></div>
        <div className="sc-head"><h3>인증된 전적</h3><button type="button" className="sc-btn" data-target="add-stats" data-cursor="pointer"><Plus size={14} />전적 추가</button><button type="button" className="sc-btn sc-btn-icon"><RefreshCw size={14} /></button></div>
        <div className="sc-card sc-stat-card">
          <div className="sc-stat-head"><Image src="/images/games/pubg.png" alt="" width={36} height={36} /><div><strong>PUBG</strong><span className="sc-sub">경쟁전 DAWN_DUO</span></div><Trash2 size={14} /></div>
          <div className="sc-tiles"><Tile label="티어" brand>Diamond 1</Tile><Tile label="K/D">3.42</Tile><Tile label="승률">18%</Tile><Tile label="판수">42</Tile></div>
        </div>
        <Collapse open={s.linked} reveal="drop">
          <div className="sc-card sc-stat-card sc-val-card" data-in={s.statsIn || undefined}>
            <div className="sc-stat-head"><Image src="/images/games/valorant.png" alt="" width={36} height={36} /><div><strong>VALORANT</strong><span className="sc-sub">경쟁전 KR Dawn#KR1</span></div><span className="sc-sub"><Roll>{s.statsIn ? '방금 연결됨' : '전적 불러오는 중'}</Roll></span></div>
            <div className="sc-tiles">
              <Tile label="티어" brand i={0}><span className="sc-emblem"><Image src={TIER} alt="" width={30} height={30} unoptimized /></span>Immortal 3</Tile>
              <Tile label="최고" i={1}>Radiant</Tile><Tile label="K/D" i={2}>1.38</Tile><Tile label="ACS" i={3}>268</Tile>
              <Tile label="헤드샷" i={4}>31%</Tile><Tile label="승률" i={5}>62%</Tile><Tile label="판수" i={6}>48</Tile><Tile label="RR" i={7}>214</Tile>
            </div>
          </div>
        </Collapse>
        <div className="sc-card sc-stat-card">
          <div className="sc-stat-head"><Image src="/images/games/lol.png" alt="" width={36} height={36} /><div><strong>League of Legends</strong><Bars w={[110]} /></div><Trash2 size={14} /></div>
          <div className="sc-tiles">{[0, 1, 2, 3].map((i) => <div key={i} className="sc-tile"><Bars w={[28, 56]} /></div>)}</div>
        </div>
      </div>
      <Rail s={s} />
    </>
  );
}

// 실제 /membership/content-preview 와 같은 예시 데이터를 그대로 쓴다.
const REPORT = MEMBERSHIP_CONTENT.weeklyReport;
const day = (date: string) => date.slice(5).replace('-', '.');
const Change = ({ now, before, unit }: { now: number | null; before: number | null; unit: string }) => {
  if (now === null || before === null) return null;
  const diff = Math.round((now - before) * 10) / 10;
  if (diff === 0) return <span>동일</span>;
  return <span data-dir={diff > 0 ? 'up' : 'down'}>{diff > 0 ? '+' : ''}{diff}{unit}</span>;
};

function Report({ s }: { s: S }) {
  return (
    <div className="sc-wide sc-report">
      <div className="sc-report-inner" data-scrolled={s.reportScrolled || undefined}>
        <h2>멤버십 콘텐츠</h2>
        <span className="sc-sub">주간 전적 리포트는 매주 월요일 갱신됩니다. · 예시 데이터입니다.</span>
        <div className="sc-card sc-report-card">
          <div className="sc-report-head">
            <div>
              <h3><BarChart3 size={18} />주간 전적 요약<span className="sc-ai">AI 리포트</span></h3>
              <span className="sc-sub">{day(REPORT.weekStart)} ~ {day(REPORT.weekEnd)} · 지난주({day(REPORT.previousWeekStart)} ~ {day(REPORT.previousWeekEnd)}) 대비</span>
            </div>
            <dl><div><dt>총 플레이</dt><dd>{REPORT.totalMatches}<span>경기</span></dd></div><div><dt>플레이한 게임</dt><dd>{REPORT.games.length}<span>개</span></dd></div></dl>
          </div>
          {REPORT.games.map((game) => {
            const prev = game.previousWeek;
            const stats = [
              { label: '경기 수', now: game.matches, before: prev?.matches ?? null, unit: '경기', changeUnit: '경기' },
              { label: '승률', now: game.winRate, before: prev?.winRate ?? null, unit: '%', changeUnit: '%p' },
              { label: 'K/D', now: game.kd, before: prev?.kd ?? null, unit: '', changeUnit: '' },
              ...(game.headshotRate !== undefined ? [{ label: '헤드샷(HS%)', now: game.headshotRate, before: prev?.headshotRate ?? null, unit: '%', changeUnit: '%p' }] : []),
            ];
            return (
              <div key={game.game} className="sc-rgame">
                <div className="sc-rgame-top">
                  <span className="sc-rgame-icon"><Gamepad2 size={17} /></span><h4>{game.gameLabel}</h4><span className="sc-grow" />
                  {game.tierLabel && <span className="sc-sub">티어{prev?.tierLabel && prev.tierLabel !== game.tierLabel && <>{' '}{prev.tierLabel}<ArrowRight size={12} /></>}<em>{game.tierLabel}</em>{prev?.tierLabel === game.tierLabel && '유지'}</span>}
                </div>
                <div className="sc-rstats" style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}>
                  {stats.map((stat) => (
                    <div key={stat.label}><span>{stat.label}</span><strong>{stat.now === null ? '—' : `${stat.now}${stat.unit}`}</strong><small><Change now={stat.now} before={stat.before} unit={stat.changeUnit} />{stat.before !== null && ` 지난주 ${stat.before}${stat.unit}`}</small></div>
                  ))}
                </div>
                <strong>{game.analysis.headline}</strong>
                <p>{game.analysis.summary}</p>
                <strong className="sc-rfocus"><Target size={15} />다음 주 체크 포인트</strong>
                <p>{game.analysis.focus}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const COMMENTS = [
  { initial: '에', name: '에임연습중', handle: 'aimpractice', text: '마지막 침착한 에임, 멋져요!' },
  { initial: '포', name: '포지션메이트', handle: 'positionmate', text: '이 각 저도 써봐야겠어요. 다음 판 같이 해요!' },
];

function Feed({ s }: { s: S }) {
  return (
    <>
      <div className="sc-col sc-feed">
        <div className="sc-feed-inner" data-scrolled={s.scrolled || undefined}>
          <div className="sc-card sc-composer" data-focus={s.drafting || undefined}>
            <Av>{ME.initial}</Av>
            <div className="sc-composer-body">
              <div className="sc-composer-text" data-target="composer" data-cursor="ibeam"><Typed text={s.draft} focus={s.drafting} placeholder="오늘의 플레이를 공유해 보세요" /></div>
              <Collapse open={s.attached}><div className="sc-attachment"><Image src={CLIP.poster} alt="" width={112} height={63} unoptimized /><div><strong>{CLIP.file}</strong><span className="sc-sub">동영상 · 0:08</span></div><X size={14} /></div></Collapse>
              <div className="sc-composer-tools"><ImageIcon size={17} /><span data-target="attach" data-cursor="pointer" data-on={s.attached || undefined}><Video size={17} /></span><Smile size={17} /><span className="sc-grow" /><button type="button" className="sc-btn sc-btn-brand" data-target="publish" data-cursor="pointer">게시</button></div>
            </div>
          </div>
          <Collapse open={s.posted} reveal="drop">
            <article className="sc-card sc-post">
              <header><Av>{ME.initial}</Av><div><MyName tier={s.rep} /><span className="sc-sub">@{ME.handle} · 방금 전</span></div><MoreHorizontal size={16} /></header>
              <p>오늘의 클러치. 마지막 판단, 어땠나요? <em>#발로란트</em></p>
              <div className="sc-media">
                <Clip playing={s.playing} />
                <div className="sc-upload" data-done={s.playing || undefined}><span><LoaderCircle size={14} />업로드 중</span><i><b style={{ transform: `scaleX(${s.progress})` }} /></i></div>
              </div>
              <footer>
                <span className="sc-like" data-on={s.likes > 0 || undefined}>
                  <Heart size={17} key={s.burst} />
                  <Count value={s.likes} />
                  {s.burst > 0 && <span className="sc-burst" key={`b${s.burst}`}>{[0, 1, 2, 3, 4].map((i) => <Heart key={i} size={13} style={{ ['--i' as string]: i }} />)}</span>}
                </span>
                <span><MessageCircle size={17} /><Count value={s.comments} /></span><span><Repeat2 size={17} />0</span><span className="sc-grow" /><Bookmark size={17} /><Upload size={17} />
              </footer>
            </article>
          </Collapse>
          <div className="sc-comments">
            {COMMENTS.map((c, i) => (
              <Collapse key={c.handle} open={s.comments > i} reveal="drop" from="below">
                <div className="sc-comment"><Av size={34}>{c.initial}</Av><div><strong>{c.name}<span className="sc-sub">@{c.handle} · 방금 전</span></strong><p>{c.text}</p></div></div>
              </Collapse>
            ))}
          </div>
          <article className="sc-card sc-post sc-post-filler">
            <header><Av> </Av><div><Bars w={[96, 140]} /></div><MoreHorizontal size={16} /></header>
            <Bars w={[420, 300]} />
            <div className="sc-media sc-media-filler" />
          </article>
        </div>
      </div>
      <Rail s={s} />
    </>
  );
}

const PROGRAMS = [
  { game: 'lol', name: 'League of Legends', w: [200, 300, 120] },
  { game: 'pubg', name: 'PUBG', w: [180, 260, 140] },
  { game: 'valorant', name: 'VALORANT', w: [220, 280, 110] },
  { game: 'rainbow6', name: 'Rainbow Six Siege', w: [190, 290, 130] },
  { game: 'lol', name: 'League of Legends', w: [210, 250, 120] },
];

function Mentoring({ s }: { s: S }) {
  return (
    <div className="sc-wide">
      <div className="sc-ment-head"><div><h2>멘토링</h2><span className="sc-sub">게임별 멘토에게 1:1로 배워 보세요.</span></div><div className="sc-mileage">내 마일리지 <strong><Count value={s.mileage} /> M</strong><em>충전</em></div></div>
      <div className="sc-tabs"><span data-on={!s.applied || undefined}>멘토 찾기</span><span data-on={s.applied || undefined}>내 멘토링</span><span>내 프로그램</span><span>멘토 되기</span></div>
      <div className="sc-ment-pane" data-on={!s.applied || undefined}>
        <div className="sc-chips"><span>전체</span><span data-on>VALORANT</span><span>League of Legends</span><span>PUBG</span><span>Rainbow Six Siege</span></div>
        <div className="sc-programs">
          <div className="sc-card sc-program">
            <div className="sc-program-top"><Image src="/images/games/valorant.png" alt="" width={22} height={22} />VALORANT<span className="sc-grow" /><Star size={13} fill="currentColor" /><b>4.9</b><span className="sc-sub">(32)</span></div>
            <h4>클러치 판단과 포지셔닝</h4>
            <p>내 플레이 영상을 함께 보며 마지막 한 수를 다듬어요.</p>
            <div className="sc-mentor"><Av size={30}>{MENTOR.initial}</Av><strong>{MENTOR.name}</strong><Image src="/images/tiers/valorant/radiant.png" alt="" width={16} height={16} unoptimized /><span className="sc-sub">Radiant</span></div>
            <div className="sc-program-foot"><span className="sc-sub"><Clock3 size={13} />60분 · 1:1</span><strong>10,000 M</strong><button type="button" className="sc-btn sc-btn-brand" data-target="apply" data-cursor="pointer">신청하기</button></div>
          </div>
          {PROGRAMS.map((p, i) => (
            <div key={i} className="sc-card sc-program sc-program-filler">
              <div className="sc-program-top"><Image src={`/images/games/${p.game}.png`} alt="" width={22} height={22} />{p.name}</div>
              <Bars w={p.w} />
              <div className="sc-mentor"><Av size={30}> </Av><Bars w={[72]} /></div>
            </div>
          ))}
        </div>
      </div>
      <div className="sc-ment-pane sc-mine" data-on={s.applied || undefined}>
        <div>
          <h3>내가 신청한 멘토링</h3>
          <div className="sc-card sc-request" data-accepted={s.accepted || undefined}>
            <div className="sc-request-top"><span className="sc-status"><Roll>{s.accepted ? '수락됨' : '신청'}</Roll></span><span className="sc-sub">멘토 {MENTOR.name}</span><span className="sc-grow" /><strong>10,000 M</strong></div>
            <h4>클러치 판단과 포지셔닝</h4>
            <p>{NOTE_TEXT}</p>
            <div className="sc-notice">{s.accepted && <CheckCircle2 size={14} />}<Roll variant="fade">{s.accepted ? '멘토가 수락했어요. 채팅으로 일정을 정해 보세요.' : '멘토의 수락을 기다리는 중입니다.'}</Roll></div>
            <div className="sc-request-actions"><button type="button" className="sc-btn" data-target="chat-start" data-cursor="pointer"><MessageCircle size={14} />채팅 시작</button><button type="button" className="sc-btn sc-btn-danger"><X size={14} />요청 취소</button></div>
          </div>
        </div>
        <div><h3>받은 멘토링 요청</h3><div className="sc-card sc-empty">표시할 요청 내역이 없습니다.</div></div>
      </div>
    </div>
  );
}

function Messages({ s }: { s: S }) {
  return (
    <div className="sc-wide sc-msg">
      <div className="sc-msg-list">
        <div className="sc-msg-title"><h2>메시지</h2><SquarePen size={17} /></div>
        <div className="sc-search"><Search size={14} />대화 또는 사용자 검색</div>
        <div className="sc-conv" data-on><Av size={38}>{MENTOR.initial}</Av><div><strong>{MENTOR.name}<span className="sc-sub">방금 전</span></strong><span className="sc-sub"><Roll>{s.replied ? '에임은 좋아요. 다음엔 엄폐물 쪽으로…' : s.sent ? '동영상을 보냈습니다.' : '수락했어요! 함께 살펴볼 플레이…'}</Roll></span></div></div>
        {[[70, 150], [90, 120]].map((w, i) => <div key={i} className="sc-conv"><Av size={38}> </Av><div><Bars w={w} /></div></div>)}
      </div>
      <div className="sc-thread">
        <header><Av size={38}>{MENTOR.initial}</Av><div><strong>{MENTOR.name}</strong><span className="sc-sub"><i className="sc-online" />접속 중</span></div><MoreHorizontal size={17} /></header>
        <div className="sc-thread-body">
          <span className="sc-day">오늘</span>
          <div className="sc-bubble">수락했어요! 함께 살펴볼 플레이 영상을 보내주세요.</div>
          <Collapse open={s.sent} reveal="drop" from="below">
            <div className="sc-bubble sc-mine-bubble">{MSG_TEXT}<Clip playing={s.sent} /><span>{CLIP.file}</span></div>
            <div className="sc-receipt" data-on={s.read || undefined}><CheckCheck size={12} />읽음 오후 2:01</div>
          </Collapse>
          <Collapse open={s.typing} reveal="drop" from="below"><div className="sc-bubble sc-typing"><i /><i /><i /></div></Collapse>
          <Collapse open={s.replied} reveal="drop" from="below"><div className="sc-bubble">에임은 좋아요. 다음엔 엄폐물 쪽으로 한 발 물러나 각을 하나씩 확인해보세요.</div></Collapse>
        </div>
        <div className="sc-msg-composer">
          <Collapse open={!s.sent}><div className="sc-chip-file"><Video size={13} />{CLIP.file}<X size={12} /></div></Collapse>
          <div className="sc-msg-row"><Paperclip size={17} /><div className="sc-msg-input" data-target="msg-input" data-cursor="ibeam" data-focus={s.msgFocus || undefined}><Typed text={s.msg} focus={s.msgFocus} placeholder="메시지를 입력하세요" /></div><button type="button" className="sc-btn sc-btn-brand sc-btn-icon" data-target="msg-send" data-cursor="pointer"><ArrowUp size={16} /></button></div>
        </div>
      </div>
    </div>
  );
}

function Modals({ s }: { s: S }) {
  return (
    <>
      <div className="sc-dim" data-on={s.linkOpen || s.applyOpen || undefined} />
      <div className="sc-modal" data-on={s.linkOpen || undefined} style={{ top: 84 }}>
        <div className="sc-modal-head"><h3>게임 전적 연결</h3><X size={17} /></div>
        <span className="sc-sub">공식 게임 계정을 연결하고 최신 전적을 불러오세요.</span>
        <div className="sc-link-form">
          <strong>VALORANT 연결</strong>
          <span className="sc-sub">PC 발로란트 Riot ID와 리전을 선택하세요. 전적은 경쟁전 기준입니다.</span>
          <label>Riot ID</label>
          <div className="sc-input" data-target="riot" data-cursor="ibeam" data-focus={s.riotFocus || undefined}><Typed text={s.riot} focus={s.riotFocus} placeholder="이름#태그" /></div>
          <label>리전</label>
          <div className="sc-seg"><span data-on>한국 (KR)</span><span>아시아·태평양 (AP)</span></div>
          <div className="sc-modal-actions"><button type="button" className="sc-btn">취소</button><button type="button" className="sc-btn sc-btn-brand" data-target="link-go" data-cursor="pointer">{s.linking && <LoaderCircle size={14} className="sc-spin" />}<Roll>{s.linking ? '불러오는 중' : '연결'}</Roll></button></div>
        </div>
        <div className="sc-game-row"><Image src="/images/games/lol.png" alt="" width={34} height={34} /><div><strong>League of Legends</strong><span className="sc-sub">티어, 승률, 최근 5경기 KDA</span></div><span>연결</span></div>
        <div className="sc-game-row"><Image src="/images/games/pubg.png" alt="" width={34} height={34} /><div><strong>PUBG</strong><span className="sc-sub">티어, 킬/데스 비율, 승률, 경기 수</span></div><span className="sc-sub">연동 완료</span></div>
      </div>
      <div className="sc-modal" data-on={s.applyOpen || undefined} style={{ top: 112 }}>
        <div className="sc-modal-head"><h3>멘토링 신청</h3><X size={17} /></div>
        <div className="sc-game-row sc-apply-program"><Av size={34}>{MENTOR.initial}</Av><div><strong>클러치 판단과 포지셔닝</strong><span className="sc-sub">멘토 {MENTOR.name} · 60분 · 1:1</span></div></div>
        <label>멘토에게 남길 말</label>
        <div className="sc-input sc-textarea" data-focus={s.applyOpen || undefined}><Typed text={s.note} focus={s.applyOpen} placeholder="배우고 싶은 내용을 적어 주세요" /></div>
        <div className="sc-pay"><span>결제 마일리지</span><strong>10,000 M</strong></div>
        <div className="sc-modal-actions"><button type="button" className="sc-btn">취소</button><button type="button" className="sc-btn sc-btn-brand" data-target="apply-go" data-cursor="pointer">신청하기</button></div>
      </div>
    </>
  );
}

function Title({ open }: { open: boolean }) {
  return (
    <div className="sc-title" data-open={open || undefined}>
      <span className="sc-title-kicker">YOUR NEXT PLAY STARTS HERE.</span>
      <div className="sc-title-text">게임 속 나를,<br /><em>게임 밖에서도.</em></div>
      <div className="sc-title-steps">{CHAPTERS.map((c) => <span key={c.label}>{c.label}</span>)}</div>
      <div className="sc-title-mark"><Image src="/logo.svg" alt="" width={34} height={34} style={{ width: 34, height: 34 }} />Gamer<em>IN</em></div>
    </div>
  );
}

const SCREENS: [Screen, (props: { s: S }) => ReactNode][] = [['profile', Profile], ['report', Report], ['feed', Feed], ['mentoring', Mentoring], ['messages', Messages]];

export default function Show({ height }: { height: number }) {
  return (
    <Stage width={1280} height={height} fill unframed initial={initial} poster={poster} script={script} play="loop" cursor={{ at: 'rest', style: 'large', ripple: true, idle: 1500 }} className="showcase-scene">
      {(s) => (
        <>
          <Camera focus={s.zoom} max={1.7} pad={24} duration={900} feather={0}>
            <div className="sc-app">
              <Sidebar s={s} />
              <div className="sc-main">
                {SCREENS.map(([name, View]) => <section key={name} className="sc-screen" data-on={s.screen === name || undefined}><View s={s} /></section>)}
              </div>
              <Modals s={s} />
            </div>
          </Camera>
          <div className="sc-toast"><Toast show={s.toastOn} icon={<Check size={14} />}>{s.toast}</Toast></div>
          <div className="sc-progress">{CHAPTERS.map((c, i) => <i key={c.label} data-on={s.chapter > i || undefined} />)}</div>
          {s.wipe > 0 && (
            <div className="sc-wipe" key={s.wipe}>
              <div className="sc-wipe-panel"><span>0{s.wipe} / 0{CHAPTERS.length} · {CHAPTERS[s.wipe - 1].label}</span><strong>{CHAPTERS[s.wipe - 1].title}</strong></div>
            </div>
          )}
          <Title open={s.cover} />
          <span className="sc-rest" data-target="rest" />
        </>
      )}
    </Stage>
  );
}
