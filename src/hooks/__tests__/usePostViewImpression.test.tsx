import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { recordPostViews, getAccessToken, getAuthGeneration } = vi.hoisted(() => ({
  recordPostViews: vi.fn(),
  getAccessToken: vi.fn(),
  getAuthGeneration: vi.fn(),
}));
vi.mock('@/lib/feed-api', () => ({ recordPostViews }));
vi.mock('@/lib/auth-store', () => ({ getAccessToken, getAuthGeneration }));

import {
  VIEW_BATCH_SIZE,
  VIEW_DWELL_MS,
  VIEW_FLUSH_DELAY_MS,
  resetPostViewImpressionForTest,
  usePostViewImpression,
} from '@/hooks/usePostViewImpression';

let callback: IntersectionObserverCallback = () => {};
const observed = new Set<Element>();
const rects = new Map<Element, DOMRect>();
let hidden = false;

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

/** 카드 윗부분이 잘리고 아래 `visibleHeight`만큼 화면 맨 위에 보이게 둔다. */
function place(element: Element, visibleHeight: number, height = 400) {
  const rect = { top: visibleHeight - height, bottom: visibleHeight, height } as DOMRect;
  rects.set(element, rect);
  return rect;
}

function show(element: Element, visibleHeight: number, height = 400) {
  const rect = place(element, visibleHeight, height);
  act(() => {
    callback([{
      target: element,
      isIntersecting: visibleHeight > 0,
      boundingClientRect: rect as DOMRectReadOnly,
      intersectionRect: { height: Math.max(visibleHeight, 0) } as DOMRectReadOnly,
      rootBounds: { height: window.innerHeight } as DOMRectReadOnly,
    } as IntersectionObserverEntry], {} as IntersectionObserver);
  });
}

function setHidden(value: boolean) {
  hidden = value;
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
}

function advance(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

function cardOf(container: HTMLElement, postId: string) {
  return container.querySelector(`[data-post="${postId}"]`)!;
}

describe('usePostViewImpression', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return rects.get(this) ?? ({ top: 0, bottom: 0, height: 0 } as DOMRect);
    });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    hidden = false;
    recordPostViews.mockReset().mockResolvedValue({ counted: 1 });
    getAccessToken.mockReturnValue('token');
    getAuthGeneration.mockReturnValue(1);
    observed.clear();
    rects.clear();
    resetPostViewImpressionForTest();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('절반 이상 1초 보이면 모았다가 5초 뒤 한 번에 보낸다', () => {
    const { container } = render(<><Card postId="a" /><Card postId="b" /></>);
    show(cardOf(container, 'a'), 240);
    show(cardOf(container, 'b'), 400);
    advance(VIEW_DWELL_MS);
    expect(recordPostViews).not.toHaveBeenCalled();
    advance(VIEW_FLUSH_DELAY_MS);
    expect(recordPostViews).toHaveBeenCalledTimes(1);
    expect(recordPostViews).toHaveBeenCalledWith(['a', 'b'], { keepalive: false });
    expect(observed.size).toBe(0);
  });

  it('1초 전에 벗어나거나 절반 미만이면 세지 않는다', () => {
    const { container } = render(<Card postId="a" />);
    const card = cardOf(container, 'a');
    show(card, 160);
    advance(VIEW_DWELL_MS * 2);
    show(card, 320);
    advance(VIEW_DWELL_MS - 1);
    show(card, 0);
    advance(VIEW_DWELL_MS + VIEW_FLUSH_DELAY_MS);
    expect(recordPostViews).not.toHaveBeenCalled();
  });

  it('화면보다 긴 카드는 화면 높이의 절반 이상 보이면 센다', () => {
    const { container } = render(<Card postId="tall" />);
    show(cardOf(container, 'tall'), 400, 3000);
    advance(VIEW_DWELL_MS + VIEW_FLUSH_DELAY_MS);
    expect(recordPostViews).toHaveBeenCalledWith(['tall'], { keepalive: false });
  });

  it('콜백 없이 기준 아래로 내려가면 1초가 끝날 때 다시 재서 세지 않는다', () => {
    const { container } = render(<Card postId="tall" />);
    const card = cardOf(container, 'tall');
    show(card, 410, 3000);
    place(card, 370, 3000);
    advance(VIEW_DWELL_MS + VIEW_FLUSH_DELAY_MS);
    expect(recordPostViews).not.toHaveBeenCalled();
    show(card, 500, 3000);
    advance(VIEW_DWELL_MS + VIEW_FLUSH_DELAY_MS);
    expect(recordPostViews).toHaveBeenCalledWith(['tall'], { keepalive: false });
  });

  it('긴 카드가 콜백 없이 화면 높이 절반 경계를 넘으면 스크롤 때 다시 재서 센다', () => {
    const { container } = render(<Card postId="tall" />);
    const card = cardOf(container, 'tall');
    show(card, 300, 3000);
    advance(VIEW_DWELL_MS + VIEW_FLUSH_DELAY_MS);
    expect(recordPostViews).not.toHaveBeenCalled();
    place(card, 400, 3000);
    act(() => { window.dispatchEvent(new Event('scroll')); });
    advance(20);
    advance(VIEW_DWELL_MS + VIEW_FLUSH_DELAY_MS);
    expect(recordPostViews).toHaveBeenCalledWith(['tall'], { keepalive: false });
  });

  it('스크롤로 기준 아래로 내려가면 타이머를 끈다', () => {
    const { container } = render(<Card postId="a" />);
    const card = cardOf(container, 'a');
    show(card, 400);
    advance(500);
    place(card, 100);
    act(() => { window.dispatchEvent(new Event('scroll')); });
    advance(20);
    place(card, 400);
    act(() => { window.dispatchEvent(new Event('scroll')); });
    advance(20);
    advance(600);
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(recordPostViews).not.toHaveBeenCalled();
    advance(VIEW_DWELL_MS);
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(recordPostViews).toHaveBeenCalledWith(['a'], { keepalive: true });
  });

  it('탭을 숨기면 1초를 처음부터 다시 잰다', () => {
    const { container } = render(<Card postId="a" />);
    show(cardOf(container, 'a'), 400);
    advance(100);
    setHidden(true);
    advance(800);
    setHidden(false);
    advance(VIEW_DWELL_MS - 1);
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(recordPostViews).not.toHaveBeenCalled();
    advance(1);
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(recordPostViews).toHaveBeenCalledWith(['a'], { keepalive: true });
  });

  it('같은 글은 다시 보여도(리포스트 카드 포함) 한 번만 보낸다', () => {
    const { container, unmount } = render(<><Card postId="a" /><div><Card postId="a" /></div></>);
    const [first, second] = container.querySelectorAll('[data-post="a"]');
    show(first, 400);
    show(second, 400);
    advance(VIEW_DWELL_MS + VIEW_FLUSH_DELAY_MS);
    unmount();
    render(<Card postId="a" />);
    expect(observed.size).toBe(0);
    expect(recordPostViews).toHaveBeenCalledTimes(1);
    expect(recordPostViews).toHaveBeenCalledWith(['a'], { keepalive: false });
  });

  it('50개가 차면 바로 보내고 나머지는 다음 묶음으로 보낸다', () => {
    const ids = Array.from({ length: VIEW_BATCH_SIZE + 1 }, (_, index) => `p${index}`);
    const { container } = render(<>{ids.map((id) => <Card key={id} postId={id} />)}</>);
    ids.forEach((id) => show(cardOf(container, id), 400));
    advance(VIEW_DWELL_MS);
    expect(recordPostViews).toHaveBeenCalledTimes(1);
    expect(recordPostViews.mock.calls[0][0]).toHaveLength(VIEW_BATCH_SIZE);
    advance(VIEW_FLUSH_DELAY_MS);
    expect(recordPostViews).toHaveBeenLastCalledWith([`p${VIEW_BATCH_SIZE}`], { keepalive: false });
  });

  it('탭을 숨기거나 페이지를 떠나면 남은 것을 keepalive로 바로 보낸다', () => {
    const { container } = render(<><Card postId="a" /><Card postId="b" /></>);
    show(cardOf(container, 'a'), 400);
    advance(VIEW_DWELL_MS);
    setHidden(true);
    expect(recordPostViews).toHaveBeenLastCalledWith(['a'], { keepalive: true });
    setHidden(false);
    show(cardOf(container, 'b'), 400);
    advance(VIEW_DWELL_MS);
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(recordPostViews).toHaveBeenLastCalledWith(['b'], { keepalive: true });
  });

  it('보내기에 실패해도 다시 보내지 않고 오류를 밖으로 내지 않는다', async () => {
    recordPostViews.mockRejectedValue(new Error('500'));
    const { container } = render(<Card postId="a" />);
    show(cardOf(container, 'a'), 400);
    await act(async () => { vi.advanceTimersByTime(VIEW_DWELL_MS + VIEW_FLUSH_DELAY_MS * 3); });
    expect(recordPostViews).toHaveBeenCalledTimes(1);
  });

  it('비로그인이면 관찰하지 않고, 로그아웃 뒤 남은 것은 버린다', () => {
    render(<Card postId="a" userId={null} />);
    expect(observed.size).toBe(0);

    const { container } = render(<Card postId="b" />);
    show(cardOf(container, 'b'), 400);
    advance(VIEW_DWELL_MS);
    getAccessToken.mockReturnValue(null);
    advance(VIEW_FLUSH_DELAY_MS);
    expect(recordPostViews).not.toHaveBeenCalled();
  });

  it('보내기 전에 인증이 바뀌면(다른 사용자로 로그인) 앞 사용자의 대기분을 보내지 않는다', () => {
    const { container } = render(<Card postId="a" />);
    show(cardOf(container, 'a'), 400);
    advance(VIEW_DWELL_MS);
    getAuthGeneration.mockReturnValue(3);
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(recordPostViews).not.toHaveBeenCalled();
  });

  it('IntersectionObserver가 없는 환경에서도 렌더가 깨지지 않는다', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    expect(() => render(<Card postId="a" />)).not.toThrow();
  });
});
