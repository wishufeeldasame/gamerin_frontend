'use client';

import { useEffect } from 'react';

// 업로드가 진행 중일 때 새로고침·탭 닫기를 하면 브라우저 확인창을 띄운다. 앱 내부 이동은 막지 않는다.
export function useUnloadWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [active]);
}
