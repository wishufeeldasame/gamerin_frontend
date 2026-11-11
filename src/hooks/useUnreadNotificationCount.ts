'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { fetchUnreadNotificationCount } from '@/lib/notification-api';
import { subscribeToNotificationInvalidation } from '@/lib/notification-sync';
import { useVisiblePolling } from '@/hooks/useVisiblePolling';

const UNREAD_REFRESH_INTERVAL_MS = 60_000;
const UNREAD_STALE_TIME_MS = 5_000;

// 앱 셸(사이드바 알림 메뉴·모바일 상단 바)이 함께 쓰는 읽지 않은 알림 수. 셸에서 한 번만 호출한다.
// 메시지 배지는 fetchCount에 fetchUnreadMessageCount를 넘겨 같은 갱신 규칙을 쓴다. fetchCount는 모듈 함수처럼 바뀌지 않는 값이어야 한다.
export function useUnreadNotificationCount(
  fetchCount: (options: { signal: AbortSignal }) => Promise<number> = fetchUnreadNotificationCount,
  intervalMs = UNREAD_REFRESH_INTERVAL_MS,
) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const requestRef = useRef<Promise<void> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRefreshRef = useRef(0);

  const refresh = useCallback(async (force = false) => {
    if (!user) {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      requestRef.current = null;
      lastRefreshRef.current = 0;
      setCount(0);
      return;
    }

    if (!force && Date.now() - lastRefreshRef.current < UNREAD_STALE_TIME_MS) {
      return;
    }

    if (requestRef.current) {
      return requestRef.current;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const request = fetchCount({ signal: controller.signal })
      .then((nextCount) => {
        if (!controller.signal.aborted) {
          setCount(nextCount);
          lastRefreshRef.current = Date.now();
        }
      })
      .catch((loadError) => {
        if (!(loadError instanceof DOMException && loadError.name === 'AbortError')) {
          setCount(0);
        }
      })
      .finally(() => {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
          requestRef.current = null;
        }
      });

    requestRef.current = request;
    return request;
  }, [user, fetchCount]);

  useEffect(() => {
    void refresh(true);

    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      requestRef.current = null;
    };
  }, [refresh]);

  useEffect(() => {
    return subscribeToNotificationInvalidation(() => {
      void refresh(true);
    });
  }, [refresh]);

  useVisiblePolling(() => refresh(), {
    enabled: Boolean(user),
    intervalMs,
  });

  return [count, setCount] as const;
}

// 셸 밖(알림 페이지)에서 읽음 처리한 결과를 셸의 배지에 반영한다.
export const UnreadNotificationCountContext = createContext<(count: number) => void>(() => {});

export function useSetUnreadNotificationCount() {
  return useContext(UnreadNotificationCountContext);
}
