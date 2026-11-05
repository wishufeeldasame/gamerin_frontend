'use client';

import { useEffect, useRef } from 'react';

// 앱 셸의 데스크톱 기준(lg, 64rem). 사이드바·모바일 상단 바가 이 폭에서 서로 바뀐다.
export const DESKTOP_QUERY = '(min-width: 64rem)';

// 창 폭이 데스크톱 기준을 넘나들 때 알린다. 한쪽 셸에서 연 패널을 다른 셸로 바뀔 때 닫는 데 쓴다.
export function useDesktopChange(listener: (isDesktop: boolean) => void, enabled = true) {
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    if (!enabled) return;
    const query = window.matchMedia?.(DESKTOP_QUERY);
    if (!query) return;
    const handleChange = (event: MediaQueryListEvent) => listenerRef.current(event.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, [enabled]);
}
