import { act, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render } from '@/test/feedback';
import type { PostRecord } from '@/lib/feed-api';
import { Post } from '../Post';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/app/context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../SaveToCollectionModal', () => ({ default: () => null }));

const observed = new Map<Element, IntersectionObserverCallback>();
const playing = new Set<HTMLMediaElement>();
const post: PostRecord = {
  postId: 'video-post', postNumber: 1, author: '작성자', authorHandle: 'author',
  authorProfileImageUrl: null, authorVerifiedBadge: false, content: '영상 피드',
  media: [1, 2].map((id) => ({
    mediaId: `video-${id}`, mediaType: 'VIDEO', mediaUrl: `/video-${id}.webm`,
    thumbnailUrl: null, sortOrder: id,
  })),
  likes: 0, comments: 0, shares: 0, repostCount: 0, isReposted: false,
  likedByMe: false, bookmarkedByMe: false, mine: false, createdAt: '2026-11-09T00:00:00Z',
};

function intersect(video: HTMLVideoElement, ratio: number) {
  act(() => observed.get(video)?.([
    { target: video, isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry,
  ], {} as IntersectionObserver));
}

beforeEach(() => {
  observed.clear();
  playing.clear();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(private readonly callback: IntersectionObserverCallback) {}
    observe(target: Element) { observed.set(target, this.callback); }
    unobserve(target: Element) { observed.delete(target); }
    disconnect() { observed.clear(); }
  });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    playing.add(this);
    fireEvent.play(this);
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    playing.delete(this);
  });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('autoplays only the most visible feed video, muted, and pauses videos that leave or unmount', () => {
  const view = render(<><Post post={post} /><Post post={{ ...post, postId: 'other' }} /></>);
  const videos = Array.from(view.container.querySelectorAll('video'));

  intersect(videos[0], 0.6);

  expect(videos[0].muted).toBe(true);
  expect(playing).toEqual(new Set([videos[0]]));
  intersect(videos[2], 0.9);
  expect(playing).toEqual(new Set([videos[2]]));
  intersect(videos[2], 0);
  expect(playing).toEqual(new Set([videos[0]]));
  intersect(videos[0], 0);
  expect(playing.size).toBe(0);
  intersect(videos[1], 1);
  expect(playing).toEqual(new Set([videos[1]]));
  view.unmount();
  expect(playing.size).toBe(0);
});

it('pauses other videos on manual playback and pauses playback in a hidden tab', () => {
  const view = render(<Post post={post} />);
  const videos = Array.from(view.container.querySelectorAll('video'));
  intersect(videos[0], 1);
  playing.add(videos[1]);

  fireEvent.play(videos[1]);

  expect(playing).toEqual(new Set([videos[1]]));
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  fireEvent(document, new Event('visibilitychange'));
  expect(playing.size).toBe(0);
});
