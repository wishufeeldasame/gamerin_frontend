import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { recordPostViews, getAccessToken } = vi.hoisted(() => ({
  recordPostViews: vi.fn(),
  getAccessToken: vi.fn(),
}));
vi.mock('@/lib/feed-api', () => ({ recordPostViews }));
vi.mock('@/lib/auth-store', () => ({ getAccessToken }));

import {
  VIEW_BATCH_SIZE,
  VIEW_DWELL_MS,
  VIEW_FLUSH_DELAY_MS,
  resetPostViewImpressionForTest,
  usePostViewImpression,
} from '@/hooks/usePostViewImpression';

let callback: IntersectionObserverCallback = () => {};
const observed = new Set<Element>();

class MockIntersectionObserver {
  constructor(cb: IntersectionObserverCallback) {
    callback = cb;
  }
  observe(element: Element) { observed.add(element); }
  unobserve(element: Element) { observed.delete(element); }
  disconnect() {}
}

function Card({ postId, userId = 'u1' }: { postId: string; userId?: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  usePostViewImpression(ref, postId, userId);
  return <div ref={ref} data-post={postId} />;
}

function show(element: Element, ratio: number, visibleHeight = 0) {
  act(() => {
    callback([{
      target: element,
      isIntersecting: ratio > 0,
      intersectionRatio: ratio,
      intersectionRect: { height: visibleHeight } as DOMRectReadOnly,
      rootBounds: { height: 800 } as DOMRectReadOnly,
    } as IntersectionObserverEntry], {} as IntersectionObserver);
  });
}

function cardOf(container: HTMLElement, postId: string) {
  return container.querySelector(`[data-post="${postId}"]`)!;
}

describe('usePostViewImpression', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    recordPostViews.mockReset().mockResolvedValue({ counted: 1 });
    getAccessToken.mockReturnValue('token');
    observed.clear();
    resetPostViewImpressionForTest();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('절반 이상 1초 보이면 모았다가 5초 뒤 한 번에 보낸다', () => {
    const { container } = render(<><Card postId="a" /><Card postId="b" /></>);
    show(cardOf(container, 'a'), 0.6);
    show(cardOf(container, 'b'), 1);
    act(() => { vi.advanceTimersByTime(VIEW_DWELL_MS); });
    expect(recordPostViews).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(VIEW_FLUSH_DELAY_MS); });
    expect(recordPostViews).toHaveBeenCalledTimes(1);
    expect(recordPostViews).toHaveBeenCalledWith(['a', 'b'], { keepalive: false });
    expect(observed.size).toBe(0);
  });

  it('1초 전에 벗어나거나 절반 미만이면 세지 않는다', () => {
    const { container } = render(<Card postId="a" />);
    const card = cardOf(container, 'a');
    show(card, 0.4, 100);
    act(() => { vi.advanceTimersByTime(VIEW_DWELL_MS * 2); });
    show(card, 0.8);
    act(() => { vi.advanceTimersByTime(VIEW_DWELL_MS - 1); });
    show(card, 0);
    act(() => { vi.advanceTimersByTime(VIEW_DWELL_MS + VIEW_FLUSH_DELAY_MS); });
    expect(recordPostViews).not.toHaveBeenCalled();
  });

  it('화면보다 긴 카드는 화면 높이의 절반 이상 보이면 센다', () => {
    const { container } = render(<Card postId="tall" />);
    show(cardOf(container, 'tall'), 0.3, 400);
    act(() => { vi.advanceTimersByTime(VIEW_DWELL_MS + VIEW_FLUSH_DELAY_MS); });
    expect(recordPostViews).toHaveBeenCalledWith(['tall'], { keepalive: false });
  });

  it('같은 글은 다시 보여도(리포스트 카드 포함) 한 번만 보낸다', () => {
    const { container, unmount } = render(<><Card postId="a" /><div><Card postId="a" /></div></>);
    const [first, second] = container.querySelectorAll('[data-post="a"]');
    show(first, 1);
    show(second, 1);
    act(() => { vi.advanceTimersByTime(VIEW_DWELL_MS + VIEW_FLUSH_DELAY_MS); });
    unmount();
    render(<Card postId="a" />);
    expect(observed.size).toBe(0);
    expect(recordPostViews).toHaveBeenCalledTimes(1);
    expect(recordPostViews).toHaveBeenCalledWith(['a'], { keepalive: false });
  });

  it('50개가 차면 바로 보내고 나머지는 다음 묶음으로 보낸다', () => {
    const ids = Array.from({ length: VIEW_BATCH_SIZE + 1 }, (_, index) => `p${index}`);
    const { container } = render(<>{ids.map((id) => <Card key={id} postId={id} />)}</>);
    ids.forEach((id) => show(cardOf(container, id), 1));
    act(() => { vi.advanceTimersByTime(VIEW_DWELL_MS); });
    expect(recordPostViews).toHaveBeenCalledTimes(1);
    expect(recordPostViews.mock.calls[0][0]).toHaveLength(VIEW_BATCH_SIZE);
    act(() => { vi.advanceTimersByTime(VIEW_FLUSH_DELAY_MS); });
    expect(recordPostViews).toHaveBeenLastCalledWith([`p${VIEW_BATCH_SIZE}`], { keepalive: false });
  });

  it('페이지를 떠나면 남은 것을 keepalive로 바로 보낸다', () => {
    const { container } = render(<Card postId="a" />);
    show(cardOf(container, 'a'), 1);
    act(() => { vi.advanceTimersByTime(VIEW_DWELL_MS); });
    window.dispatchEvent(new Event('pagehide'));
    expect(recordPostViews).toHaveBeenCalledWith(['a'], { keepalive: true });
  });

  it('보내기에 실패해도 다시 보내지 않고 오류를 밖으로 내지 않는다', async () => {
    recordPostViews.mockRejectedValue(new Error('500'));
    const { container } = render(<Card postId="a" />);
    show(cardOf(container, 'a'), 1);
    await act(async () => { vi.advanceTimersByTime(VIEW_DWELL_MS + VIEW_FLUSH_DELAY_MS * 3); });
    expect(recordPostViews).toHaveBeenCalledTimes(1);
  });

  it('비로그인이면 관찰하지 않고, 로그아웃 뒤 남은 것은 버린다', () => {
    render(<Card postId="a" userId={null} />);
    expect(observed.size).toBe(0);

    const { container } = render(<Card postId="b" />);
    show(cardOf(container, 'b'), 1);
    act(() => { vi.advanceTimersByTime(VIEW_DWELL_MS); });
    getAccessToken.mockReturnValue(null);
    act(() => { vi.advanceTimersByTime(VIEW_FLUSH_DELAY_MS); });
    expect(recordPostViews).not.toHaveBeenCalled();
  });

  it('IntersectionObserver가 없는 환경에서도 렌더가 깨지지 않는다', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    expect(() => render(<Card postId="a" />)).not.toThrow();
  });
});
