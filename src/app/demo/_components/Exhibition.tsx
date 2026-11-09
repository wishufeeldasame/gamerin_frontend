'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Maximize, Minimize, Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/components/stageshow/kit/reduced-motion';
import { chapterAt, SHOW_ASSETS, SHOW_CHAPTERS, SHOW_DURATION } from '../_data/story';

const LOAD_ERROR = '소개 영상을 불러오지 못했어요. 연결을 확인하고 처음부터 버튼으로 다시 시도해주세요.';

export default function Exhibition() {
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [run, setRun] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState('');
  const [time, setTime] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [failed, setFailed] = useState(false);
  const reduced = useReducedMotion();
  const chapter = chapterAt(time);
  const current = SHOW_CHAPTERS[chapter];
  const cover = reduced || time < 5000 || time >= 54000;
  const caption = !cover && time - current.at < 1300;

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === root.current);
    const visibility = () => setHidden(document.hidden);
    visibility();
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('visibilitychange', visibility);
    return () => { document.removeEventListener('fullscreenchange', sync); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  useEffect(() => {
    const element = video.current;
    if (!element || failed) return;
    if (paused || reduced || hidden) { element.pause(); return; }
    let active = true;
    void element.play().catch((error: DOMException) => {
      if (active && error.name !== 'AbortError') {
        if (element.error || error.name === 'NotSupportedError') {
          setFailed(true);
          setNotice(LOAD_ERROR);
        } else {
          setPaused(true);
          setNotice('자동재생을 시작하지 못했어요. 재생 버튼을 눌러주세요.');
        }
      }
    });
    return () => { active = false; element.pause(); };
  }, [paused, reduced, hidden, failed, run]);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (root.current?.requestFullscreen) await root.current.requestFullscreen();
      else throw new Error('unsupported');
      setNotice('');
    } catch {
      setNotice('전체화면을 열 수 없어요. 브라우저의 전체화면 기능을 사용해주세요.');
    }
  }

  return (
    <main className="exhibition" ref={root}>
      <header className="ex-header">
        <Link href="/about" className="ex-wordmark" aria-label="GamerIN 소개 페이지"><Image src="/logo.png" alt="" width={28} height={28} />GamerIN<span>.</span></Link>
        <span className="ex-edition">PLAY. CONNECT. GROW.</span>
        <span className="ex-runtime">60초 · 무음 · 자동 반복</span>
      </header>
      <h1 className="sr-only">GamerIN — 실력을 기록하고, 플레이를 나누고, 함께 성장하세요.</h1>
      <div className="ex-theater" aria-hidden="true">
        <div className="ex-frame" data-chapter={chapter}>
          <video key={run} ref={video} className="ex-film" src={SHOW_ASSETS.video} poster={SHOW_ASSETS.poster} muted playsInline loop preload={reduced ? 'none' : 'auto'} onTimeUpdate={(event) => setTime(event.currentTarget.currentTime * 1000)} onError={() => { setFailed(true); setNotice(LOAD_ERROR); }} />
          {failed && <Image src={SHOW_ASSETS.poster} alt="" fill sizes="100vw" className="ex-film-poster" />}
          <div className="ex-cover" data-open={cover}>
            <span className="ex-cover-kicker">YOUR NEXT PLAY STARTS HERE.</span>
            <div className="ex-cover-title">게임 속 나를,<br /><em>게임 밖에서도.</em></div>
            <p>실력을 기록하고. 플레이를 나누고.<br className="ex-mobile-break" /> 함께 성장하세요.</p>
            <div className="ex-cover-steps"><span>전적 프로필</span><span>영상 공유</span><span>1:1 멘토링</span></div>
            <strong>GamerIN<span>.</span></strong>
          </div>
          <div className="ex-caption" data-open={caption} key={chapter}><span>0{chapter} / {current.label}</span><div>{current.title}</div></div>
        </div>
      </div>
      <p className="sr-only">배틀그라운드 전적이 연결된 프로필에 발로란트를 연결합니다. 플레이 영상과 썸네일을 게시하고 좋아요·댓글·리포스트를 받습니다. 평점과 후기를 보고 멘토링을 신청합니다. 수락 후 영상을 공유하고 피드백을 받은 뒤 완료하고 후기를 남깁니다. 모든 계정·전적·평점·후기는 예시이며 실제 신청이나 게시는 발생하지 않습니다.</p>
      <footer className="ex-footer">
        <span className="ex-disclaimer">실제 서비스 화면 녹화 · 데이터는 예시</span>
        <div className="ex-progress" aria-hidden="true"><span>{current.label}</span><progress max={SHOW_DURATION} value={time} /><span>{Math.min(60, Math.floor(time / 1000)).toString().padStart(2, '0')} / 60</span></div>
        <div className="ex-controls">
          {reduced ? <span>모션 줄이기 · 정적 소개</span> : <>
            <button type="button" onClick={() => setPaused((value) => !value)} aria-pressed={paused} aria-label={paused ? '재생' : '일시정지'}>{paused ? <Play size={16} /> : <Pause size={16} />}<span>{paused ? '재생' : '일시정지'}</span></button>
            <button type="button" onClick={() => {
              setTime(0);
              setNotice('');
              setPaused(false);
              if (failed) { setFailed(false); setRun((value) => value + 1); }
              else if (video.current) { video.current.currentTime = 0; void video.current.play(); }
            }}><RotateCcw size={16} /><span>처음부터</span></button>
          </>}
          <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? '전체화면 종료' : '전체화면'}>{fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}<span>{fullscreen ? '화면 축소' : '전체화면'}</span></button>
        </div>
      </footer>
      <p role="status" className={notice ? 'ex-notice' : 'sr-only'}>{notice}</p>
    </main>
  );
}
