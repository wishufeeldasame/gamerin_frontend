'use client';

import { useEffect, type RefObject } from 'react';
import { getAccessToken, getAuthGeneration } from '@/lib/auth-store';
import { recordPostViews } from '@/lib/feed-api';

/*
 * 카드 노출 집계(백엔드 #183, design-system-v2 README 결정 F24).
 * 카드가 화면에 절반 이상(또는 화면 높이의 절반 이상을 차지하며) 보이는 상태가 탭이 보이는 채로 1초 이어지면 노출 1회로 본다.
 * 탭 하나에서 같은 글은 한 번만 보고하고, 모아서 50개가 차거나 첫 노출 뒤 5초가 지나면 보낸다.
 * 탭을 숨기거나 떠날 때 남은 것을 keepalive로 보낸다. 실패는 다시 보내지 않는다.
 */
export const VIEW_VISIBLE_RATIO = 0.5;
export const VIEW_DWELL_MS = 1_000;
export const VIEW_BATCH_SIZE = 50;
export const VIEW_FLUSH_DELAY_MS = 5_000;

// 카드가 화면보다 길면 비율이 0.5에 못 미친다. 화면 높이 기준 경계는 threshold로 잡을 수 없어,
// 화면에 걸친 카드가 있는 동안 스크롤마다(프레임당 1번) 다시 재고 1초가 끝날 때도 다시 잰다.
const THRESHOLDS = Array.from({ length: 11 }, (_, index) => index / 10);

type Target = { postId: string; intersecting: boolean; seen: boolean; timer: ReturnType<typeof setTimeout> | null };

let ownerId: string | null = null;
const reported = new Set<string>();
let pending: string[] = [];
// 대기분을 모은 인증 세대. 로그아웃·로그인·토큰 갱신마다 바뀌므로 다른 사용자 토큰으로 보내지 않는다.
let pendingGeneration: number | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let observer: IntersectionObserver | null = null;
const targets = new Map<Element, Target>();
let recheckFrame: number | null = null;
let watchingScroll = false;
const SCROLL_OPTIONS = { capture: true, passive: true } as const;

function flush(keepalive = false) {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  // 그사이 로그아웃했거나 인증이 바뀌었으면 버린다. 조회수는 근사치라 덜 세는 쪽을 택한다.
  if (!getAccessToken() || getAuthGeneration() !== pendingGeneration) {
    pending = [];
    return;
  }
  while (pending.length > 0) {
    const batch = pending.splice(0, VIEW_BATCH_SIZE);
    // 서버가 24시간 중복을 거르고 조회수는 근사치이므로 실패해도 다시 보내지 않는다.
    void recordPostViews(batch, { keepalive }).catch(() => undefined);
  }
}

function enqueue(postId: string) {
  if (reported.has(postId)) return;
  reported.add(postId);
  const generation = getAuthGeneration();
  if (generation !== pendingGeneration) {
    pending = [];
    pendingGeneration = generation;
  }
  pending.push(postId);
  if (pending.length >= VIEW_BATCH_SIZE) flush();
  else flushTimer ??= setTimeout(() => flush(), VIEW_FLUSH_DELAY_MS);
}

function meetsVisibility(visibleHeight: number, height: number, viewportHeight: number) {
  return visibleHeight > 0
    && (visibleHeight >= height * VIEW_VISIBLE_RATIO || visibleHeight >= viewportHeight * VIEW_VISIBLE_RATIO);
}

function isSeen(entry: IntersectionObserverEntry) {
  return entry.isIntersecting && meetsVisibility(
    entry.intersectionRect.height,
    entry.boundingClientRect.height,
    entry.rootBounds?.height ?? window.innerHeight,
  );
}

function isSeenNow(element: Element) {
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
  return meetsVisibility(visibleHeight, rect.height, viewportHeight);
}

function disarm(target: Target) {
  if (target.timer !== null) clearTimeout(target.timer);
  target.timer = null;
}

function arm(element: Element, target: Target) {
  if (target.seen && !document.hidden) target.timer ??= setTimeout(() => commit(element), VIEW_DWELL_MS);
}

function recheck() {
  recheckFrame = null;
  targets.forEach((target, element) => {
    if (!target.intersecting) return;
    target.seen = isSeenNow(element);
    if (target.seen) arm(element, target);
    else disarm(target);
  });
}

function scheduleRecheck() {
  recheckFrame ??= requestAnimationFrame(recheck);
}

function updateScrollWatch() {
  const needed = [...targets.values()].some((target) => target.intersecting);
  if (needed === watchingScroll) return;
  watchingScroll = needed;
  if (needed) {
    window.addEventListener('scroll', scheduleRecheck, SCROLL_OPTIONS);
    window.addEventListener('resize', scheduleRecheck);
  } else {
    window.removeEventListener('scroll', scheduleRecheck, SCROLL_OPTIONS);
    window.removeEventListener('resize', scheduleRecheck);
  }
}

function unobserve(element: Element) {
  const target = targets.get(element);
  if (target) disarm(target);
  targets.delete(element);
  observer?.unobserve(element);
  updateScrollWatch();
}

function commit(element: Element) {
  const target = targets.get(element);
  if (!target) return;
  target.timer = null;
  if (document.hidden) return;
  if (!isSeenNow(element)) {
    target.seen = false;
    return;
  }
  enqueue(target.postId);
  unobserve(element);
}

function handleEntries(entries: IntersectionObserverEntry[]) {
  for (const entry of entries) {
    const target = targets.get(entry.target);
    if (!target) continue;
    target.intersecting = entry.isIntersecting;
    target.seen = isSeen(entry);
    if (target.seen) arm(entry.target, target);
    else disarm(target);
  }
  updateScrollWatch();
}

function getObserver() {
  if (!observer) {
    observer = new IntersectionObserver(handleEntries, { threshold: THRESHOLDS });
    // 숨긴 탭에서는 보고 있지 않으므로 1초를 처음부터 다시 잰다. 화면 이동은 모듈이 살아 있어 타이머가 보낸다.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        targets.forEach(disarm);
        flush(true);
      } else {
        targets.forEach((target, element) => arm(element, target));
      }
    });
    window.addEventListener('pagehide', () => flush(true));
  }
  return observer;
}

/** 게시물 카드가 실제로 보였을 때 조회수 집계에 보고한다. 비로그인이거나 IntersectionObserver가 없으면 아무것도 하지 않는다. */
export function usePostViewImpression(
  ref: RefObject<Element | null>,
  postId: string,
  userId: string | null | undefined,
) {
  useEffect(() => {
    const element = ref.current;
    if (!element || !userId || typeof IntersectionObserver === 'undefined') return;
    if (userId !== ownerId) {
      // 다른 사용자로 바뀌면 앞 사용자의 보고 기록을 비운다.
      ownerId = userId;
      reported.clear();
      pending = [];
    }
    if (reported.has(postId)) return;
    targets.set(element, { postId, intersecting: false, seen: false, timer: null });
    getObserver().observe(element);
    return () => unobserve(element);
  }, [ref, postId, userId]);
}

/** 테스트 전용: 모듈 상태를 비운다. */
export function resetPostViewImpressionForTest() {
  if (flushTimer !== null) clearTimeout(flushTimer);
  targets.forEach(disarm);
  targets.clear();
  if (recheckFrame !== null) cancelAnimationFrame(recheckFrame);
  recheckFrame = null;
  updateScrollWatch();
  flushTimer = null;
  observer = null;
  ownerId = null;
  pendingGeneration = null;
  reported.clear();
  pending = [];
}
