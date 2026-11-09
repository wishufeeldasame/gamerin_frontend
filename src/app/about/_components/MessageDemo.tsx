'use client';

import { ArrowUp, Paperclip } from 'lucide-react';
import { Avatar, Bubble, Button, Field, Receipt, Stage, Thread, Window, type Act } from '@/components/stageshow';
import { demoConversation as conversation } from '../_data/fixtures';
import type { DemoSceneProps } from './DemoPlayer';

type Scene = { draft: string; sent: boolean; delivered: boolean; read: boolean; typing: boolean };
const initial: Scene = { draft: '', sent: false, delivered: false, read: false, typing: false };
const poster: Scene = { ...initial, sent: true, delivered: true, read: true };

async function script(a: Act<Scene>) {
  await a.wait(800);
  await a.click({ at: 'compose', x: 0.3, y: 0.5 });
  await a.set({ typing: true });
  a.mark('typing');
  await a.type('draft', conversation.sent, { interval: 80 });
  await a.wait(650);
  await a.click('send');
  await a.set({ sent: true, draft: '', typing: false });
  a.mark('sent');
  await a.wait(800);
  await a.set({ delivered: true });
  a.mark('delivered');
  await a.wait(700);
  await a.set({ read: true });
  a.mark('read');
  await a.move('message-rest');
  await a.wait(2400);
}

export default function MessageDemo({ paused }: DemoSceneProps) {
  return (
    <Stage width={640} height={340} compact={{ below: 560, width: 358, height: 340 }} initial={initial} poster={poster} script={script} paused={paused} play="once" cursor={{ at: 'message-rest' }} className="gamerin-scene message-scene">
      {(s) => <>
        <Window url="GamerIN / 메시지" className="scene-window message-window" lights="grey">
          <div className="message-layout">
            <div className="message-conversation">
              <div className="message-head"><Avatar name={conversation.name} size={30} /><div><strong>{conversation.name}</strong><span>함께 플레이하는 사이</span></div></div>
              <div className="message-day">오늘</div>
              <Thread className="message-thread"><Bubble from="them">{conversation.received}</Bubble>{s.sent && <Bubble from="me" source="draft-text">{conversation.sent}</Bubble>}<Receipt show={s.delivered}>{s.read ? '읽음' : '전송됨'}</Receipt></Thread>
              <div className="message-composer"><Paperclip size={16} /><Field value={s.draft} focused={s.typing} placeholder="메시지를 입력하세요" box={{ 'data-target': 'compose' }} text={{ 'data-target': 'draft-text', 'data-typing': s.typing || undefined }} /><Button variant="primary" data-target="send" icon={<ArrowUp size={14} />}>전송</Button></div>
              <div className="message-footnote">나의 다음 듀오를 만나는 곳</div>
            </div>
          </div>
        </Window>
        <span className="scene-rest" data-target="message-rest" />
      </>}
    </Stage>
  );
}
