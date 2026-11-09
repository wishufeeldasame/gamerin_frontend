'use client';

import Image from 'next/image';
import { ArrowUpRight, Check, Clock3, UserRound } from 'lucide-react';
import { Avatar, Badge, Button, Card, Popover, Roll, Row, Stage, Tabs, Window, type Act } from '@/components/stageshow';
import { demoMentoring as program } from '../_data/fixtures';
import type { DemoSceneProps } from './DemoPlayer';

type Scene = { filter: number; open: boolean; applied: boolean };
const initial: Scene = { filter: 0, open: false, applied: false };
const poster: Scene = { filter: 1, open: true, applied: true };

async function script(a: Act<Scene>) {
  await a.wait(800);
  a.mark('filter');
  await a.click('game-lol');
  await a.set({ filter: 1 });
  await a.wait(800);
  await a.click({ at: 'program', x: 0.88, y: 0.5 });
  await a.set({ open: true });
  a.mark('detail');
  await a.wait(1400);
  await a.click({ at: 'apply', x: 0.88, y: 0.5 });
  await a.set({ applied: true });
  a.mark('applied');
  await a.move('mentoring-rest');
  await a.wait(2400);
}

export default function MentoringDemo({ paused }: DemoSceneProps) {
  return (
    <Stage width={640} height={420} compact={{ below: 560, width: 358, height: 340 }} initial={initial} poster={poster} script={script} paused={paused} play="once" cursor={{ at: 'mentoring-rest' }} className="gamerin-scene mentoring-scene">
      {(s, _rect, layout) => <>
        <Window url="GamerIN / 멘토링" className="scene-window mentoring-window" lights="grey">
          <div className="mentoring-content">
            <div className="scene-section-head"><span>함께 찾는 다음 티어</span><Badge tone="accent">1:1</Badge></div>
            <Tabs items={['전체', '리그 오브 레전드', '발로란트']} value={s.filter} targets={[undefined, 'game-lol']} />
            <Card className="mentoring-program" pad={layout === 'compact' ? 'small' : 'medium'} gap={layout === 'compact' ? 8 : 14}>
              <Row lead={<Avatar name={program.mentor} size={34} />} title={program.mentor} subtitle={layout === 'wide' ? '리플레이로 함께 성장하는 코치' : undefined} />
              <div className="mentoring-program-title">{program.title}</div>
              <div className="scene-muted">{program.description}</div>
              <div className="mentoring-meta"><Clock3 size={14} />{program.duration}</div>
              <div className="mentoring-price"><strong>{program.price}</strong><Button data-target="program" trailingIcon={<ArrowUpRight size={14} />}>자세히 보기</Button></div>
            </Card>
            <Row className="mentoring-neighbor" lead={<Image src="/images/games/valorant.png" alt="" width={24} height={24} />} title="다른 플레이, 새로운 가능성" subtitle="내 게임에 맞는 멘토를 찾아보세요" />
          </div>
        </Window>
        <span data-target="mentoring-rest" className="scene-rest" />
        <Popover show={s.open} origin="center" className="mentoring-detail" style={{ left: layout === 'compact' ? 32 : 182, top: layout === 'compact' ? 32 : 80, width: layout === 'compact' ? 294 : 360 }}>
          <div className="mentoring-detail-top"><span>멘토링 신청</span><Badge tone="accent">리그 오브 레전드</Badge></div>
          <div className="mentoring-detail-title">{program.title}</div>
          <Row lead={<Avatar name={program.mentor} size={30} />} title={program.mentor} meta="DIAMOND" />
          <div className="mentoring-detail-info"><span><Clock3 size={14} />60분</span><span><UserRound size={14} />1:1 리플레이</span></div>
          <div className="mentoring-detail-footer"><strong>{program.price}</strong><Button variant="primary" data-target="apply" icon={s.applied ? <Check size={14} /> : undefined}>{s.applied ? '신청 접수됨' : '신청하기'}</Button></div>
          <div className="mentoring-application-note" data-done={s.applied || undefined}><Roll variant="fade">{s.applied ? '멘토의 수락을 기다리고 있어요.' : '내 플레이를 위한 첫걸음을 시작하세요.'}</Roll></div>
        </Popover>
      </>}
    </Stage>
  );
}
