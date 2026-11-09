'use client';

import { useEffect, useRef } from 'react';

const videos = new Map<HTMLVideoElement, number>();
let observer: IntersectionObserver | null = null;
let activeVideo: HTMLVideoElement | null = null;

function selectVideo() {
  let next: HTMLVideoElement | null = null;
  let bestRatio = 0.5;
  if (document.visibilityState !== 'hidden') {
    for (const [video, ratio] of videos) {
      if (ratio >= bestRatio && (ratio > bestRatio || !next || video === activeVideo)) {
        next = video;
        bestRatio = ratio;
      }
    }
  }
  if (next === activeVideo) return;
  activeVideo?.pause();
  activeVideo = next;
  if (next) {
    next.muted = true;
    const selected = next;
    void selected.play().catch(() => {
      // 브라우저가 자동재생을 거절하면 기본 컨트롤로 재생할 수 있다.
      if (activeVideo === selected) activeVideo = null;
    });
  }
}

export function useFeedVideoPlayback() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || typeof IntersectionObserver === 'undefined') return;

    if (!observer) {
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.target instanceof HTMLVideoElement && videos.has(entry.target)) {
            videos.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
          }
        }
        selectVideo();
      }, { threshold: [0, 0.5, 0.6, 0.7, 0.8, 0.9, 1] });
      document.addEventListener('visibilitychange', selectVideo);
    }
    videos.set(video, 0);
    observer.observe(video);

    const handlePlay = () => {
      for (const other of videos.keys()) {
        if (other !== video) other.pause();
      }
      activeVideo = video;
    };
    video.addEventListener('play', handlePlay);

    return () => {
      video.removeEventListener('play', handlePlay);
      observer?.unobserve(video);
      videos.delete(video);
      video.pause();
      if (activeVideo === video) activeVideo = null;
      if (videos.size === 0) {
        observer?.disconnect();
        observer = null;
        document.removeEventListener('visibilitychange', selectVideo);
      } else {
        selectVideo();
      }
    };
  }, []);

  return ref;
}
