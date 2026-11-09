'use client';

import Image from 'next/image';
import { BadgeCheck, Check, ChevronRight, Heart, MessageCircle, Repeat2, Star, Upload, UserRound, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Avatar, Badge, Bubble, Button, Card, Collapse, Count, Field, Meter, Roll, Row, Thread, Window } from '@/components/stageshow';
import { SHOW_ASSETS, SHOW_CHAPTERS, SHOW_DURATION, SHOW_POST, SHOW_REVIEWS, type ShowState } from '../_data/story';

function Highlight({ playing, paused }: { playing: boolean; paused: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video || failed) return;
    if (!playing || paused) video.pause();
    else {
      let active = true;
      void video.play().catch((error: DOMException) => { if (active && error.name !== 'AbortError') setFailed(true); });
      return () => { active = false; video.pause(); };
    }
  }, [playing, paused, failed]);
  return <div className="ex-highlight">
    {failed ? <><Image src={SHOW_ASSETS.poster} alt="발로란트 플레이 하이라이트" fill sizes="(max-width: 600px) 320px, 520px" /><span className="ex-video-fallback">영상 대신 선택한 썸네일을 보여드려요.</span></> : <video ref={ref} src={SHOW_ASSETS.video} poster={SHOW_ASSETS.poster} muted playsInline preload="auto" onError={() => setFailed(true)} />}
    <span className="ex-video-label">VALORANT · PLAY HIGHLIGHT</span>
  </div>;
}

function Profile({ s }: { s: ShowState }) {
  return <div className="ex-profile">
    <div className="ex-profile-banner">MY PLAY, MY IDENTITY.</div>
    <Row lead={<Avatar name="새벽의듀오" size={48} />} title={<>새벽의듀오 <BadgeCheck size={16} /></>} subtitle="@dawn · 플레이로 나를 소개해요" />
    <div className="ex-section-title">전적으로 증명하는 나<Button data-target="add-game" icon={<UserRound size={14} />}>게임 연결</Button></div>
    <div className="ex-game-grid">
      <Card className="ex-game" pad="large" gap={16}>
        <div className="ex-game-name"><Image src="/images/games/pubg.png" alt="" width={32} height={20} /><strong>배틀그라운드</strong><Badge tone="success">연결됨</Badge></div>
        <div className="ex-rank"><Image src="/images/tiers/pubg/diamond-1.webp" alt="" width={86} height={86} /><div><span>RANKED SQUAD</span><strong>다이아몬드</strong><small>DAWN_DUO</small></div></div>
        <div className="ex-metrics"><div><span>K/D</span><b>3.42</b></div><div><span>평균 피해량</span><b>428</b></div><div><span>TOP 10</span><b>64%</b></div></div>
      </Card>
      <Card className="ex-game" pad="large" gap={16}>
        <div className="ex-game-name"><Image src="/images/games/valorant.png" alt="" width={32} height={20} /><strong>발로란트</strong><Badge tone={s.linked ? 'success' : 'neutral'}>{s.linked ? '연결됨' : '새 계정'}</Badge></div>
        <div className="ex-link-states" data-linked={s.linked}>
          <div className="ex-unlinked"><UserRound size={38} /><strong>전적을 프로필에 더해보세요.</strong><span>Riot ID로 간편하게 연결</span></div>
          <div className="ex-linked"><div className="ex-rank"><Image src="/images/tiers/valorant/ascendant-3.png" alt="" width={86} height={86} /><div><span>COMPETITIVE</span><strong>초월자 III</strong><small>Dawn#KR1</small></div></div><div className="ex-metrics"><div><span>승률</span><b>62%</b></div><div><span>K/D</span><b>1.38</b></div><div><span>헤드샷</span><b>28%</b></div></div></div>
        </div>
      </Card>
    </div>
    <div className="ex-profile-note"><BadgeCheck size={16} /><Roll>{s.linked ? '두 게임의 실력을, 하나의 프로필에.' : '게임 계정으로 인증된 나의 전적'}</Roll></div>
    <div className="ex-connect-overlay" data-open={s.connecting}>
      <Card pad="large" gap={16} className="ex-connect-card"><strong>발로란트 계정 연결</strong><Field label="Riot ID" value={s.riotId} placeholder="닉네임#태그" focused box={{ 'data-target': 'riot-id' }} /><Button data-target="connect-game" variant="primary">{s.time >= 9000 ? '전적 불러오는 중…' : '연결하기'}</Button></Card>
    </div>
  </div>;
}

function Feed({ s, paused, compact }: { s: ShowState; paused: boolean; compact: boolean }) {
  return <div className="ex-feed" data-posted={s.posted}>
    <div className="ex-section-title">플레이를 나누는 공간<Badge>발로란트</Badge></div>
    <div className="ex-feed-grid">
      <Card pad="large" gap={12} className="ex-post">
        <Row pad={0} lead={<Avatar name="새벽의듀오" size={32} />} title="새벽의듀오" subtitle={s.posted ? '방금 전 · 발로란트' : '새 플레이 공유'} />
        <div className="ex-composer" data-open={!s.posted}>
          <Field value={s.draft} placeholder="어떤 플레이를 보여주고 싶나요?" box={{ 'data-target': 'post-draft' }} focused={s.attached && !s.upload} />
          <div className="ex-attach" data-attached={s.attached}>
            <div className="ex-attach-placeholder"><Upload size={26} /><span>나누고 싶은 플레이를 올려보세요.</span></div>
            <Image src={SHOW_ASSETS.thumbnails[s.thumbnail]} alt="선택한 플레이 영상 썸네일" fill sizes="520px" />
            <Badge>8초 · 무음 하이라이트</Badge>
          </div>
          <Collapse open={s.attached}><div className="ex-thumbnail-picker"><span>썸네일 선택</span><div>{SHOW_ASSETS.thumbnails.map((src, i) => <span key={src} data-target={`thumbnail-${i}`} data-cursor="pointer" data-selected={s.thumbnail === i}><Image src={src} alt={`썸네일 후보 ${i + 1}`} width={120} height={68} />{s.thumbnail === i && <Check size={16} />}</span>)}</div></div></Collapse>
          <div className="ex-composer-actions"><Button data-target="attach" icon={<Upload size={14} />}>영상 첨부</Button><Button data-target="publish" variant="primary">{s.upload ? '게시 중…' : '게시하기'}</Button></div>
          <Collapse open={s.upload > 0}><Meter value={s.upload / 100} /></Collapse>
        </div>
        <div className="ex-published" data-open={s.posted}>
          <div className="ex-post-text">{SHOW_POST}</div>
          <Highlight playing={s.playing && s.posted} paused={paused} />
          <div className="ex-reactions"><span><Heart size={18} /><Count value={s.likes} /></span><span><MessageCircle size={18} /><Count value={s.comments} /></span><span><Repeat2 size={18} /><Count value={s.reposts} /></span></div>
        </div>
      </Card>
      <div className="ex-social">
        <div className="ex-social-title">플레이에서 시작된 대화</div>
        {!compact && <div className="ex-social-empty" data-open={s.comments === 0}><MessageCircle size={28} /><span>같은 게임을 즐기는 사람들과<br />나누는, 나의 한 장면.</span></div>}
        <Collapse open={s.comments >= 1} reveal="drop"><Row lead={<Avatar name="에임연습중" size={30} />} title="에임연습중" subtitle="마지막 침착한 에임, 멋져요!" /></Collapse>
        <Collapse open={s.comments >= 2} reveal="drop"><Row lead={<Avatar name="포지션메이트" size={30} />} title="포지션메이트" subtitle="저 타이밍에 들어가는 판단 좋네요." /></Collapse>
        <Collapse open={s.reply}><Row className="ex-comment-reply" lead={<Avatar name="새벽의듀오" size={26} />} title="새벽의듀오" subtitle="감사해요! 다음 플레이도 올릴게요." /></Collapse>
        <Collapse open={s.followed} reveal="drop"><Card pad="small" tone="sunken"><div className="ex-followed"><Users size={16} />에임연습중님이 팔로우했어요.</div></Card></Collapse>
      </div>
    </div>
  </div>;
}

function Mentoring({ s }: { s: ShowState }) {
  return <div className="ex-mentoring" data-accepted={s.accepted}>
    <div className="ex-section-title"><Roll>{s.accepted ? '함께 바꾸는 다음 플레이' : '내게 맞는 멘토 찾기'}</Roll><Badge tone={s.completed ? 'success' : 'neutral'}>{s.completed ? '완료' : s.accepted ? '진행 중' : '발로란트'}</Badge></div>
    <div className="ex-programs" data-open={!s.accepted}>
      <Card pad="large" gap={16} className="ex-program">
        <Row pad={0} lead={<Avatar name="클러치코치" size={46} />} title={<>클러치코치 <BadgeCheck size={14} /></>} subtitle="발로란트 · 불멸 III" />
        <strong className="ex-program-title">승부를 바꾸는<br />클러치 판단과 포지셔닝</strong>
        <div className="ex-rating"><Star size={18} fill="currentColor" /><b>4.9</b><span>후기 24개</span></div>
        <div className="ex-program-tags"><Badge>1:1 영상 피드백</Badge><Badge>판단 · 포지셔닝</Badge></div>
        <p>내 플레이를 함께 보며,<br />놓치고 있던 습관을 찾아요.</p>
        <Button data-target="program-open" variant="primary" trailingIcon={<ChevronRight size={14} />}>프로그램 살펴보기</Button>
      </Card>
      <div className="ex-program-detail" data-open={s.program}>
        <div className="ex-review-heading">먼저 경험한 게이머들의 후기</div>
        {SHOW_REVIEWS.map((review) => <Row key={review.name} lead={<Avatar name={review.name} size={28} />} title={review.name} subtitle={review.text} meta={<span className="ex-review-stars">★★★★★</span>} />)}
        <div className="ex-apply"><Button data-target="apply-program" variant="primary" icon={s.applied ? <Check size={14} /> : undefined}>{s.applied ? '신청 완료' : '멘토링 신청'}</Button><span><Roll>{s.applied ? '멘토의 수락을 기다리고 있어요.' : '후기를 확인했다면, 나도 시작해볼까요?'}</Roll></span></div>
      </div>
    </div>
    <div className="ex-session" data-open={s.accepted}>
      <div className="ex-session-head"><Row pad={0} lead={<Avatar name="클러치코치" size={32} />} title="클러치코치 · 1:1 멘토링" subtitle="멘토가 신청을 수락했어요." /><Button data-target="share-video" icon={<Upload size={14} />}>플레이 영상 공유</Button></div>
      <Thread className="ex-session-thread">
        <Bubble from="them">반가워요! 함께 살펴볼 플레이를 보내주세요.</Bubble>
        {s.shared && <Bubble from="me"><div className="ex-shared-video"><Image src={SHOW_ASSETS.poster} alt="공유한 발로란트 영상" width={112} height={63} /><span>오늘의 클러치.mp4<br /><small>마지막 진입 판단이 궁금해요.</small></span></div></Bubble>}
        {s.feedback && <Bubble from="them">에임은 좋아요. 다음엔 엄폐물 쪽으로 한 발 물러나 각을 하나씩 확인해보세요.</Bubble>}
        {s.finished && <Bubble from="me">한 번에 여러 각을 열고 있었네요. 다음 판에 적용해볼게요!</Bubble>}
      </Thread>
      <div className="ex-session-bottom">
        <Button data-target="complete-session" variant={s.completed ? 'secondary' : 'primary'} icon={s.completed ? <Check size={14} /> : undefined}>{s.completed ? '멘토링 완료' : '완료하기'}</Button>
        <div className="ex-write-review" data-open={s.completed}><span className="ex-review-stars">★★★★★</span><Field value={s.review} placeholder="함께한 멘토링은 어땠나요?" /><Button data-target="submit-review" variant="primary">{s.reviewed ? '후기 등록 완료' : '후기 등록'}</Button></div>
      </div>
    </div>
  </div>;
}

export function ShowScreen({ s, compact, paused }: { s: ShowState; compact: boolean; paused: boolean }) {
  const chapter = SHOW_CHAPTERS[s.chapter];
  return <>
    <div className="ex-story" data-chapter={s.chapter}>
      <div className="ex-copy" key={s.chapter}><span className="ex-chapter-label">0{Math.min(s.chapter, 5)} / {chapter.label}</span><div className="ex-headline">{chapter.title}</div><p>{chapter.detail}</p><span className="ex-copy-rule" /></div>
      <Window url={<>GamerIN / <Roll>{s.page === 'profile' ? '프로필' : s.page === 'feed' ? '커뮤니티' : '멘토링'}</Roll></>} lights="grey" className="ex-window">
        <div className="ex-app-nav"><span data-active={s.page === 'profile'}>프로필</span><span data-active={s.page === 'feed'}>커뮤니티</span><span data-active={s.page === 'mentoring'} data-target="mentoring-nav" data-cursor="pointer">멘토링</span><Avatar name="새벽의듀오" size={24} /></div>
        <div className="ex-app-body">
          <div className="ex-panel" data-open={s.page === 'profile'}><Profile s={s} /></div>
          <div className="ex-panel" data-open={s.page === 'feed'}><Feed s={s} paused={paused} compact={compact} /></div>
          <div className="ex-panel" data-open={s.page === 'mentoring'}><Mentoring s={s} /></div>
        </div>
      </Window>
    </div>
    <div className="ex-cover" data-open={s.cover !== null}>
      <div className="ex-cover-kicker">YOUR NEXT PLAY STARTS HERE.</div>
      <div className="ex-cover-title">게임 속 나를,<br /><em>게임 밖에서도.</em></div>
      <div className="ex-cover-sub">실력을 기록하고. 플레이를 나누고. 함께 성장하세요.</div>
      <div className="ex-cover-steps"><span>전적 프로필</span><ChevronRight size={18} /><span>영상 공유</span><ChevronRight size={18} /><span>1:1 멘토링</span></div>
      <span className="ex-cover-brand">GamerIN<span>.</span></span>
    </div>
    <div className="ex-timeline"><div className="ex-timeline-chapters">{SHOW_CHAPTERS.slice(1, 6).map((c, i) => <span key={c.at} data-current={s.chapter === i + 1} data-done={s.chapter > i + 1}>{c.label}</span>)}</div><Meter value={s.time / SHOW_DURATION} /><span className="ex-time">{Math.min(60, Math.floor(s.time / 1000)).toString().padStart(2, '0')} / 60</span></div>
    <span className="ex-rest" data-target="rest" />
  </>;
}
