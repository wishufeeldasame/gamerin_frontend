'use client';

import Image from 'next/image';
import { Bookmark, Check, Folder, Heart, MessageCircle, MoreHorizontal } from 'lucide-react';
import { Avatar, Badge, Bar, Button, Card, Popover, Row, Stage, Toast, Window, type Act } from '@/components/stageshow';
import { demoPost as post } from '../_data/fixtures';
import type { DemoSceneProps } from './DemoPlayer';

type Scene = { open: boolean; saved: boolean };
const initial: Scene = { open: false, saved: false };
const poster: Scene = { open: false, saved: true };

async function script(a: Act<Scene>) {
  await a.wait(1000);
  a.mark('collection');
  await a.click('bookmark');
  await a.set({ open: true });
  await a.wait(1500);
  await a.click({ at: 'collection', x: 0.88, y: 0.5 });
  await a.set({ saved: true });
  await a.wait(650);
  await a.set({ open: false });
  a.mark('saved');
  await a.move('feed-rest');
  await a.wait(2400);
}

export default function FeedDemo({ paused }: DemoSceneProps) {
  return (
    <Stage width={640} height={420} compact={{ below: 560, width: 358, height: 340 }} initial={initial} poster={poster} script={script} paused={paused} play="once" cursor={{ at: 'feed-rest' }} className="gamerin-scene feed-scene">
      {(s, rect, layout) => {
        const anchor = rect('bookmark');
        const popWidth = layout === 'compact' ? 278 : 288;
        return <>
          <Window url="GamerIN / 홈" className="scene-window feed-window" lights="grey">
            <div className="feed-content">
              <div className="scene-section-head"><span>당신의 다음 플레이</span><MoreHorizontal size={16} /></div>
              <Card className="feed-post" pad="small" gap={10}>
                <Row lead={<Avatar name={post.author} size={layout === 'compact' ? 26 : 30} />} title={post.author} meta="방금 전" pad={8} />
                <div className="feed-post-copy"><strong>{post.content}</strong>{layout === 'wide' && <span>{post.detail}</span>}</div>
                <div className="feed-game-art"><Image src="/images/games/lol.png" alt="" width={1200} height={630} sizes="68px" style={{ width: layout === 'compact' ? 32 : 68, height: 'auto' }} /><div><strong>{layout === 'compact' ? '시야를 넓히는 플레이' : <>시야가 바뀌면,<br />플레이가 바뀌니까.</>}</strong></div></div>
                <div className="feed-actions"><span><Heart size={14} />24</span><span><MessageCircle size={14} />3</span><Button variant="ghost" size="small" icon={<Bookmark size={12} fill={s.saved ? 'currentColor' : 'none'} />} data-target="bookmark" data-open={s.open || undefined}>{s.saved ? '저장됨' : '저장'}</Button></div>
              </Card>
              <div className="feed-filler"><Row lead={<Avatar size={26} />} title={<Bar w={70} h={6} />} /><Bar w={216} h={6} /><Bar w={144} h={6} /></div>
            </div>
          </Window>
          <span className="scene-rest" data-target="feed-rest" />
          <Popover show={s.open} origin="bottom right" className="feed-collection" style={{ left: anchor.x + anchor.width - popWidth, top: anchor.y - 160, width: popWidth }}>
            <div className="collection-title">컬렉션에 저장<span>나만의 플레이북</span></div>
            <Row lead={<Folder size={18} />} title={post.collection} data-target="collection" selected={s.saved} meta={<Check size={14} className="collection-check" data-on={s.saved || undefined} />} />
            <div className="collection-hint"><Badge tone="neutral">다시 보고 싶은 순간을 모아요</Badge></div>
          </Popover>
          <div className="feed-toast-position"><Toast className="collection-result" show={s.saved && !s.open} icon={<Check size={14} />}>컬렉션에 저장했어요</Toast></div>
        </>;
      }}
    </Stage>
  );
}
