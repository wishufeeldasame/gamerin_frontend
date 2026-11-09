'use client';

import { Pause, Play, RotateCcw } from 'lucide-react';
import { useState, type ComponentType } from 'react';
import { useReducedMotion } from '@/components/stageshow/kit/reduced-motion';

export type DemoSceneProps = { paused: boolean };

export function DemoPlayer({ scene: Scene, label, description, id }: {
  scene: ComponentType<DemoSceneProps>;
  label: string;
  description: string;
  id: string;
}) {
  const [run, setRun] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();

  return (
    <figure className="demo-player" id={id} aria-label={`${label} 소개 애니메이션`}>
      <div className="demo-player-picture" aria-hidden="true" inert>
        <Scene key={run} paused={paused} />
      </div>
      <figcaption className="demo-player-caption">
        <span className="demo-scene-label"><span className="demo-caption-dot" />{label}<span className="demo-caption-kind">예시 화면</span></span>
        <span className="demo-playback">
          {reduced ? <span className="demo-reduced">정적 미리보기</span> : <>
            <button type="button" onClick={() => setPaused((value) => !value)} aria-label={`${label} ${paused ? '재생' : '일시정지'}`} aria-pressed={paused}>
              {paused ? <Play size={14} /> : <Pause size={14} />}<span>{paused ? '재생' : '일시정지'}</span>
            </button>
            <button type="button" onClick={() => { setPaused(false); setRun((value) => value + 1); }} aria-label={`${label} 다시 보기`}>
              <RotateCcw size={14} /><span>다시 보기</span>
            </button>
          </>}
        </span>
      </figcaption>
      <p className="sr-only">{description}</p>
    </figure>
  );
}
