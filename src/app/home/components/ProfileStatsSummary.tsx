'use client';

import { Gamepad2 } from 'lucide-react';

export interface RepresentativeStat {
  gameName: string;
  tier?: string | null;
  kd: number;
  winRate: number;
  playCount: number;
  tierImageUrl?: string | null;
}

interface ProfileStatsSummaryProps {
  data: RepresentativeStat | null;
  fallbackText?: string;
}

export function ProfileStatsSummary({
  data,
  fallbackText = 'Tell your gaming story on GamerIN.',
}: ProfileStatsSummaryProps) {
  if (!data) {
    return (
      <p className="max-w-xl whitespace-pre-wrap text-[17px] font-medium leading-relaxed text-zinc-800">
        {fallbackText || '게임을 연동하고 전적을 뽐내보세요!'}
      </p>
    );
  }

  return (
    <p className="flex max-w-xl flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold leading-relaxed text-neutral-600">
      <Gamepad2 size={17} className="shrink-0 text-neutral-500" />
      <span className="font-black text-neutral-800">{data.gameName}</span>
      <span className="text-neutral-300">|</span>
      {data.tier ? <span>{data.tier}</span> : null}
      {data.tier ? <span className="text-neutral-300">·</span> : null}
      <span>K/D {data.kd.toFixed(2)}</span>
      <span className="text-neutral-300">·</span>
      <span>승률 {data.winRate}%</span>
      <span className="text-neutral-300">·</span>
      <span>{data.playCount.toLocaleString()}게임</span>
    </p>
  );
}
