'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

// Stage 는 브라우저 크기를 재므로 클라이언트에서만 그린다.
const Show = dynamic(() => import('./Show'), { ssr: false });
const WIDTH = 1280;

export default function Showcase() {
  // 무대 폭은 1280 으로 두고 높이를 창 비율에 맞춘다(16:9 PC 720 ~ 4:3 아이패드 960). 그 밖의 비율은 가운데에 둔다.
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const read = () => setHeight(Math.round(Math.min(960, Math.max(720, (WIDTH * window.innerHeight) / window.innerWidth))));
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);

  return (
    <main className="showcase">
      <h1 className="sr-only">GamerIN — 전적을 연동하고, 플레이를 나누고, 멘토와 함께 성장하세요.</h1>
      {height > 0 && (
        <div className="showcase-frame" data-ss-fill aria-hidden="true" style={{ aspectRatio: `${WIDTH} / ${height}`, width: `min(100vw, calc(100dvh * ${WIDTH} / ${height}))` }}>
          <Show key={height} height={height} />
        </div>
      )}
      <p className="sr-only">프로필에서 발로란트 전적을 연동하면 닉네임 옆에 대표 티어가 표시됩니다. 피드에 게임 클립을 올리면 영상이 재생되고 좋아요와 댓글이 달립니다. 멘토링 프로그램을 신청하고 멘토와 메시지로 대화합니다. 모든 계정·전적·게시물은 예시입니다.</p>
    </main>
  );
}
