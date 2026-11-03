'use client';

import { RefreshCw } from 'lucide-react';

type AdminRefreshStatusProps = {
  isRefreshing: boolean;
  lastUpdatedAt: Date | null;
  onRefresh: () => void;
};

function formatRefreshTime(value: Date | null) {
  if (!value) return '갱신 전';
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(value);
}

export function AdminRefreshStatus({
  isRefreshing,
  lastUpdatedAt,
  onRefresh,
}: AdminRefreshStatusProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-[#98a2b3]">
      <span aria-live="polite">
        {isRefreshing ? '새 데이터 확인 중' : `마지막 갱신 ${formatRefreshTime(lastUpdatedAt)}`}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#d0d5dd] bg-white px-2.5 font-semibold text-[#344054] transition hover:bg-[#f9fafb] disabled:cursor-wait disabled:text-[#98a2b3]"
      >
        <RefreshCw
          className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
          strokeWidth={1.8}
          aria-hidden="true"
        />
        새로고침
      </button>
    </div>
  );
}
