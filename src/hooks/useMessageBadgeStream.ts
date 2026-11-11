'use client';

import { useEffect } from 'react';
import { openMessageEventSource } from '@/lib/message-api';
import { invalidateNotifications } from '@/lib/notification-sync';

const RETRY_DELAY_MS = 10_000;

// 메시지 화면 밖에서도 새 메시지가 오면 셸의 메시지 배지를 바로 갱신한다.
// 메시지 화면은 자체 스트림으로 같은 갱신을 하므로 enabled를 꺼서 탭당 연결을 하나로 유지한다.
// 서버가 사용자당 연결 수를 제한하므로 보이는 탭에서만 연결하고, 밀려나면 다시 붙지 않는다(배지는 폴링으로 갱신된다).
export function useMessageBadgeStream(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let eventSource: EventSource | null = null;
    let retryTimer: number | null = null;
    let connecting = false;
    let replaced = false;
    let cancelled = false;

    const close = () => {
      if (retryTimer) window.clearTimeout(retryTimer);
      retryTimer = null;
      eventSource?.close();
      eventSource = null;
    };

    const connect = async () => {
      if (cancelled || replaced || connecting || eventSource || document.hidden) return;
      connecting = true;
      try {
        const next = await openMessageEventSource();
        if (cancelled || document.hidden) {
          next.close();
          return;
        }
        eventSource = next;
        const refresh = () => invalidateNotifications('message-created');
        next.addEventListener('message-created', refresh);
        next.addEventListener('message-deleted', refresh);
        next.addEventListener('connection-replaced', () => {
          replaced = true;
          close();
        });
        next.onerror = () => {
          close();
          if (!cancelled) retryTimer = window.setTimeout(() => { retryTimer = null; void connect(); }, RETRY_DELAY_MS);
        };
      } catch {
        // 토큰 발급 실패는 다시 시도하지 않는다. 다음에 탭이 다시 보일 때 연결을 시도한다.
      } finally {
        connecting = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) close();
      else void connect();
    };

    void connect();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      close();
    };
  }, [enabled]);
}
