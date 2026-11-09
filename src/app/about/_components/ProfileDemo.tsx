'use client';

import Image from 'next/image';
import { BadgeCheck, RefreshCw } from 'lucide-react';
import { Avatar, Badge, Button, Card, Roll, Stage, Tabs, Window, type Act } from '@/components/stageshow';
import { demoProfile as profile } from '../_data/fixtures';
import type { DemoSceneProps } from './DemoPlayer';

type Scene = { loading: boolean; updated: boolean };
const initial: Scene = { loading: false, updated: false };
const poster: Scene = { loading: false, updated: true };

async function script(a: Act<Scene>) {
  await a.wait(1100);
  a.mark('refresh');
  await a.click({ at: 'refresh', x: 0.5, y: 0.5 });
  await a.set({ loading: true });
  await a.wait(1500);
  a.mark('updated');
  await a.set({ loading: false, updated: true });
  await a.move('profile-rest');
  await a.wait(2400);
}

export default function ProfileDemo({ paused }: DemoSceneProps) {
  return (
    <Stage width={720} height={480} compact={{ below: 600, width: 358, height: 340 }} initial={initial} poster={poster} script={script} paused={paused} play="once" fidelity="realistic" cursor={{ at: 'profile-rest' }} className="gamerin-scene profile-scene">
      {(s, _rect, layout) => {
        const content = <>
          {layout === 'wide' && <div className="profile-cover"><span>PLAY. CONNECT. GROW.</span></div>}
          <div className="profile-content">
            {layout === 'wide' && <><div className="profile-identity">
              <Avatar name={profile.name} size={52} tone="accent" />
              <div><div className="scene-person">{profile.name}<BadgeCheck size={16} /></div><div className="scene-muted">@{profile.handle}</div></div>
              {layout === 'wide' && <Button variant="secondary">프로필 편집</Button>}
            </div>
            <div className="profile-bio">{profile.bio}</div></>}
            {layout === 'wide' && <Tabs items={['전적', '게시물', '미디어']} value={0} />}
            <div className="scene-section-head"><span>인증된 전적</span><Button data-target="refresh" icon={<RefreshCw size={12} />} size="small">새로고침</Button></div>
            <Card className="profile-stats" pad="medium" gap={14}>
              <div className="profile-game"><Image src="/images/games/lol.png" alt="" width={1200} height={630} sizes="24px" style={{ width: 24, height: 'auto' }} /><span>{profile.game}</span><Badge tone="success">연결됨</Badge></div>
              <div className="profile-rank" data-loading={s.loading || undefined}>
                <Image src="/images/tiers/lol/diamond.png" alt="" width={76} height={76} className="profile-emblem" />
                <div><div className="scene-overline">SOLO / DUO</div><div className="profile-tier">{profile.tier}</div><div className="scene-muted">{profile.games}경기 · 랭크</div></div>
              </div>
              <div className="profile-metrics" data-loading={s.loading || undefined}>
                <div><span>승률</span><strong>{profile.winRate}</strong></div><div><span>KDA</span><strong>{profile.kda}</strong></div>
              </div>
              <div className="profile-updated"><BadgeCheck size={13} /><Roll>{s.loading ? '전적 불러오는 중' : s.updated ? '방금 업데이트됨' : '게임 계정으로 인증된 전적'}</Roll></div>
            </Card>
          </div>
        </>;
        return <><Window url={layout === 'compact' ? `GamerIN / ${profile.name}` : 'GamerIN / 프로필'} className="scene-window profile-window" lights="grey">{content}</Window><span className="scene-rest" data-target="profile-rest" /></>;
      }}
    </Stage>
  );
}
