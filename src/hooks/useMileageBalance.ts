'use client';

import { useEffect, useState } from 'react';
import { fetchMyMileageBalance } from '@/lib/mileage-api';
import { subscribeToMileageInvalidation } from '@/lib/mileage-sync';
import { DESKTOP_QUERY } from './useDesktopChange';

export function useMileageBalance(userId: string | undefined, surface: 'desktop' | 'mobile') {
  const [result, setResult] = useState<{ userId: string; balance: number | null } | null>(null);

  useEffect(() => {
    // 사용자 객체는 프로필 수정 때마다 바뀌므로 계정이 바뀔 때만 다시 구독한다.
    if (!userId) return;
    const desktop = window.matchMedia?.(DESKTOP_QUERY);
    let latestRequest = 0;
    let disposed = false;

    const load = () => {
      // 잔액은 현재 폭에서 보이는 사이드바나 프로필 카드에서만 조회한다.
      if (desktop && desktop.matches !== (surface === 'desktop')) return;
      const request = ++latestRequest;
      const settle = (next: number | null) => {
        if (!disposed && request === latestRequest) setResult({ userId, balance: next });
      };
      fetchMyMileageBalance()
        .then((response) => settle(response.currentBalance))
        .catch(() => settle(null));
    };
    // 내 동작(멘토링 신청·취소, 결제)은 mileage-sync 신호로 바로 반영한다.
    // 다른 사람·서버가 바꾼 잔액(멘토 거절 환불, 정산, 관리자 처리)은 탭으로 돌아올 때 따라잡는다.
    const loadWhenVisible = () => {
      if (document.visibilityState === 'visible') load();
    };

    load();
    const unsubscribe = subscribeToMileageInvalidation(load);
    document.addEventListener('visibilitychange', loadWhenVisible);
    desktop?.addEventListener?.('change', load);
    return () => {
      disposed = true;
      unsubscribe();
      document.removeEventListener('visibilitychange', loadWhenVisible);
      desktop?.removeEventListener?.('change', load);
    };
  }, [userId, surface]);

  return result?.userId === userId ? result?.balance ?? null : null;
}
