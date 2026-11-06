'use client';

import { useEffect, type RefObject } from 'react';
import { getAccessToken } from '@/lib/auth-store';
import { recordPostViews } from '@/lib/feed-api';

/*
 * 카드 노출 집계(백엔드 #183, design-system-v2 README 결정 F24).
 * 카드가 화면에 절반 이상(또는 화면 높이의 절반 이상을 차지하며) 1초 계속 보이면 노출 1회로 본다.
 * 탭 하나에서 같은 글은 한 번만 보고하고, 모아서 50개가 차거나 첫 노출 뒤 5초가 지나면 보낸다.
 * 탭을 숨기거나 떠날 때 남은 것을 keepalive로 보낸다. 실패는 다시 보내지 않는다.
 */
export const VIEW_VISIBLE_RATIO = 0.5;
export const VIEW_DWELL_MS = 1_000;
export const VIEW_BATCH_SIZE = 50;
export const VIEW_FLUSH_DELAY_MS = 5_000;

// 카드가 화면보다 훨씬 길면 비율이 0.5에 못 미친다. 0.1 단위로 받아 보이는 높이로도 판정한다.
const THRESHOLDS = Array.from({ length: 11 }, (_, index) => index / 10);

let ownerId: string | null = null;
const reported = new Set<string>();
let pending: string[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let observer: IntersectionObserver | null = null;
const targets = new Map<Element, { postId: string; timer: ReturnType<typeof setTimeout> | null }>();

function flush(keepalive = false) {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  // 로그아웃 뒤 남은 것은 버린다(비로그인 요청은 서버가 401로 거절한다).
  if (!getAccessToken()) {
    pending = [];
    return;
  }
  while (pending.length > 0) {
    const batch = pending.splice(0, VIEW_BATCH_SIZE);
    // 조회수는 근사치이고 서버가 24시간 중복을 거르므로 실패해도 다시 보내지 않는다.
    void recordPostViews(batch, { keepalive }).catch(() => undefined);
  }
}

function enqueue(postId: string) {
  if (reported.has(postId)) return;
  reported.add(postId);
  pending.push(postId);
  if (pending.length >= VIEW_BATCH_SIZE) flush();
  else flushTimer ??= setTimeout(() => flush(), VIEW_FLUSH_DELAY_MS);
}

function isSeen(entry: IntersectionObserverEntry) {
  if (!entry.isIntersecting) return false;
  if (entry.intersectionRatio >= VIEW_VISIBLE_RATIO) return true;
  const viewportHeight = entry.rootBounds?.height ?? window.innerHeight;
  return entry.intersectionRect.height >= viewportHeight * VIEW_VISIBLE_RATIO;
}

function unobserve(element: Element) {
  const target = targets.get(element);
  if (target?.timer != null) clearTimeout(target.timer);
  targets.delete(element);
  observer?.unobserve(element);
}

function commit(element: Element) {
  const target = targets.get(element);
  if (!target) return;
  target.timer = null;
  // 숨긴 탭에서는 보고 있지 않다. 다시 보일 때까지 판정을 미룬다.
  if (document.hidden) {
    target.timer = setTimeout(() => commit(element), VIEW_DWELL_MS);
    return;
  }
  enqueue(target.postId);
  unobserve(element);
}

function handleEntries(entries: IntersectionObserverEntry[]) {
  for (const entry of entries) {
    const target = targets.get(entry.target);
    if (!target) continue;
    if (isSeen(entry)) {
      target.timer ??= setTimeout(() => commit(entry.target), VIEW_DWELL_MS);
    } else if (target.timer !== null) {
      clearTimeout(target.timer);
      target.timer = null;
    }
  }
}

function getObserver() {
  if (!observer) {
    observer = new IntersectionObserver(handleEntries, { threshold: THRESHOLDS });
    // 화면 이동은 모듈이 살아 있어 타이머가 보낸다. 탭을 숨기거나 문서를 떠날 때만 바로 보낸다.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) flush(true);
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
      // 다른 사용자로 바뀌면 앞 사용자의 기록과 대기분을 버린다(새 토큰으로 보내지 않게).
      ownerId = userId;
      reported.clear();
      pending = [];
    }
    if (reported.has(postId)) return;
    targets.set(element, { postId, timer: null });
    getObserver().observe(element);
    return () => unobserve(element);
  }, [ref, postId, userId]);
}

/** 테스트 전용: 모듈 상태를 비운다. */
export function resetPostViewImpressionForTest() {
  if (flushTimer !== null) clearTimeout(flushTimer);
  targets.forEach((target) => {
    if (target.timer !== null) clearTimeout(target.timer);
  });
  targets.clear();
  flushTimer = null;
  observer = null;
  ownerId = null;
  reported.clear();
  pending = [];
}
