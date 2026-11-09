'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Maximize, Minimize, Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Stage } from '@/components/stageshow';
import { useReducedMotion } from '@/components/stageshow/kit/reduced-motion';
import { SHOW_INITIAL, SHOW_POSTER } from '../_data/story';
import { exhibitionScript } from './show-script';
import { ShowScreen } from './ShowScreen';

export default function Exhibition() {
  const root = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);
  const [run, setRun] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState('');
  const reduced = useReducedMotion();

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

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
      <div className="ex-theater" aria-hidden="true" inert>
        <div className="ex-frame">
          <Stage key={run} width={1280} height={650} compact={{ below: 600, width: 358, height: 620 }} initial={SHOW_INITIAL} poster={SHOW_POSTER} script={exhibitionScript} paused={paused} theme="dark" accent="#e8b84b" fill fidelity="realistic" cursor={{ at: 'rest', ripple: true, idle: 1000 }} className="ex-stage">
            {(s, _rect, layout) => <ShowScreen s={s} compact={layout === 'compact'} paused={paused} />}
          </Stage>
        </div>
      </div>
      <p className="sr-only">배틀그라운드 전적이 연결된 프로필에 발로란트를 연결합니다. 플레이 영상과 썸네일을 게시하고 좋아요·댓글·리포스트를 받습니다. 평점과 후기를 보고 멘토링을 신청합니다. 수락 후 영상을 공유하고 피드백을 받은 뒤 완료하고 후기를 남깁니다. 모든 계정·전적·평점·후기는 예시이며 실제 신청이나 게시는 발생하지 않습니다.</p>
      <footer className="ex-footer">
        <span className="ex-disclaimer">예시 데이터로 구성한 소개 화면</span>
        <div className="ex-controls">
          {reduced ? <span>모션 줄이기 · 정적 소개</span> : <>
            <button type="button" onClick={() => setPaused((value) => !value)} aria-pressed={paused} aria-label={paused ? '재생' : '일시정지'}>{paused ? <Play size={16} /> : <Pause size={16} />}<span>{paused ? '재생' : '일시정지'}</span></button>
            <button type="button" onClick={() => { setRun((value) => value + 1); setPaused(false); }}><RotateCcw size={16} /><span>처음부터</span></button>
          </>}
          <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? '전체화면 종료' : '전체화면'}>{fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}<span>{fullscreen ? '화면 축소' : '전체화면'}</span></button>
        </div>
      </footer>
      <p role="status" className={notice ? 'ex-notice' : 'sr-only'}>{notice}</p>
    </main>
  );
}
