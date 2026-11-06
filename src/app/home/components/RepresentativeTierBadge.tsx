'use client';

import Image from 'next/image';
import { useState } from 'react';
import { type RepresentativeTier, tierAltText, tierEmblemSrc, toRepresentativeTier } from '@/lib/representative-tier';

/**
 * 대표 게임 티어 엠블럼. `MembershipBadge` 바로 뒤에 두고 같은 크기를 쓴다.
 * 티어 글자는 화면에 쓰지 않고 대체 텍스트·툴팁으로만 둔다. 이미지가 없거나 로드에 실패하면 숨긴다.
 */
export function RepresentativeTierBadge({ tier: rawTier, size = 16 }: { tier?: RepresentativeTier | null; size?: number }) {
  // 응답 타입은 검증 없이 통과하므로 여기서 한 번 검증한다.
  const tier = toRepresentativeTier(rawTier);
  const src = tier ? tierEmblemSrc(tier) : null;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!tier || !src || failedSrc === src) return null;

  const label = tierAltText(tier);
  return (
    <span title={label} className="inline-flex shrink-0 items-center">
      {/* 원본 비율이 게임마다 달라(PUBG 288×275) 정사각형 칸에 맞춰 넣는다. */}
      <Image
        src={src}
        alt={label}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="object-contain"
        onError={() => setFailedSrc(src)}
      />
    </span>
  );
}
