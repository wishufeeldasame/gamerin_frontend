import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMessageBadgeStream } from '@/hooks/useMessageBadgeStream';
import { subscribeToNotificationInvalidation } from '@/lib/notification-sync';

const openMessageEventSource = vi.hoisted(() => vi.fn());
vi.mock('@/lib/message-api', () => ({ openMessageEventSource }));

function fakeEventSource() {
  const listeners = new Map<string, () => void>();
  return {
    close: vi.fn(),
    addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
    emit: (type: string) => listeners.get(type)?.(),
    onerror: null as (() => void) | null,
  };
}

describe('useMessageBadgeStream', () => {
  beforeEach(() => openMessageEventSource.mockReset());

  it('새 메시지 이벤트가 오면 배지 갱신을 알리고, 꺼지면 연결을 닫는다', async () => {
    const source = fakeEventSource();
    openMessageEventSource.mockResolvedValue(source);
    const invalidated = vi.fn();
    const unsubscribe = subscribeToNotificationInvalidation(invalidated);

    const { rerender } = renderHook(({ enabled }) => useMessageBadgeStream(enabled), { initialProps: { enabled: true } });
    await waitFor(() => expect(openMessageEventSource).toHaveBeenCalledTimes(1));
    await waitFor(() => { source.emit('message-created'); expect(invalidated).toHaveBeenCalled(); });

    rerender({ enabled: false });
    expect(source.close).toHaveBeenCalled();
    unsubscribe();
  });

  it('꺼져 있으면 연결하지 않고, 서버가 밀어낸 연결은 닫은 뒤 다시 붙지 않는다', async () => {
    renderHook(() => useMessageBadgeStream(false));
    expect(openMessageEventSource).not.toHaveBeenCalled();

    const source = fakeEventSource();
    openMessageEventSource.mockResolvedValue(source);
    renderHook(() => useMessageBadgeStream(true));
    await waitFor(() => { source.emit('connection-replaced'); expect(source.close).toHaveBeenCalled(); });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(openMessageEventSource).toHaveBeenCalledTimes(1);
  });
});
