'use client';

import { useEffect } from 'react';

// 모달을 Esc로 닫는다. 확인창처럼 위에 뜬 다이얼로그가 먼저 처리(preventDefault)했으면 무시한다.
export function useEscapeKey(onEscape: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
      onEscape();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onEscape]);
}
