'use client';

import dynamic from 'next/dynamic';

// Stage 는 브라우저 크기를 재므로 클라이언트에서만 그린다.
const Show = dynamic(() => import('./Show'), { ssr: false });

export default function Showcase() {
  return (
    <div className="showcase">
      <div className="showcase-frame" data-ss-fill aria-hidden="true" style={{ aspectRatio: '1280 / 720', width: '100%' }}>
        <Show height={720} />
      </div>
    </div>
  );
}
