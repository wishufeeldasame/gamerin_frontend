'use client';

import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import { useToast } from '@/app/context/ToastContext';
import { usePendingPosts } from '@/hooks/usePendingPosts';
import type { PostRecord } from '@/lib/feed-api';

type CreatedPostListener = (post: PostRecord) => void;

type PendingPostsContextValue = ReturnType<typeof usePendingPosts> & {
  // 완료된 게시물을 피드에 넣고 싶은 화면이 구독한다. 반환 함수로 구독을 해제한다.
  subscribeCreated: (listener: CreatedPostListener) => () => void;
};

const PendingPostsContext = createContext<PendingPostsContextValue | null>(null);

/**
 * 업로드 중인 게시물을 앱 공통 레이아웃에서 관리한다. 영상은 서버 처리에 시간이 걸리므로
 * 다른 화면으로 이동해도 처리 상태를 계속 확인하고, 끝나면 상단에 "업로드 완료"를 띄운다.
 */
export function PendingPostsProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const listenersRef = useRef(new Set<CreatedPostListener>());

  const handleCreated = useCallback((post: PostRecord) => {
    listenersRef.current.forEach((listener) => listener(post));
  }, []);
  const handleVideoProcessed = useCallback(() => {
    toast.success('업로드 완료', { placement: 'top' });
  }, [toast]);

  const { pendingPosts, submit, retry, discard } = usePendingPosts(handleCreated, {
    onVideoProcessed: handleVideoProcessed,
  });

  const subscribeCreated = useCallback((listener: CreatedPostListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const value = useMemo(
    () => ({ pendingPosts, submit, retry, discard, subscribeCreated }),
    [pendingPosts, submit, retry, discard, subscribeCreated]
  );

  return <PendingPostsContext.Provider value={value}>{children}</PendingPostsContext.Provider>;
}

export function usePendingPostsContext() {
  const context = useContext(PendingPostsContext);
  if (!context) {
    throw new Error('usePendingPostsContext must be used within PendingPostsProvider.');
  }
  return context;
}
