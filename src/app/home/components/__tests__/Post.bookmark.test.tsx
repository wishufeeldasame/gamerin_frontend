import { fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '@/test/feedback';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostRecord } from '@/lib/feed-api';

const mocks = vi.hoisted(() => ({
  bookmarkPost: vi.fn(),
  deletePost: vi.fn(),
  unbookmarkPost: vi.fn(),
}));

vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => ({ user: { handle: 'viewer' } }),
}));

vi.mock('@/lib/feed-api', () => ({
  bookmarkPost: mocks.bookmarkPost,
  deletePost: mocks.deletePost,
  formatRelativeTime: () => '방금 전',
  getInitials: () => 'A',
  unbookmarkPost: mocks.unbookmarkPost,
  updatePostBookmarkState: (post: PostRecord, bookmarkedByMe: boolean) => ({
    ...post,
    bookmarkedByMe,
  }),
}));

vi.mock('@/hooks/useRepost', () => ({
  useRepost: () => ({
    isReposted: false,
    repostCount: 0,
    isLoading: false,
    error: null,
    toggleRepost: vi.fn(),
  }),
}));

vi.mock('../SaveToCollectionModal', () => ({
  default: ({
    isOpen,
    onBookmarkStateChange,
  }: {
    isOpen: boolean;
    onBookmarkStateChange?: (
      isBookmarked: boolean,
      options?: { skipRequest?: boolean },
    ) => Promise<boolean>;
  }) =>
    isOpen ? (
      <div>
        <button
          type="button"
          onClick={() => void onBookmarkStateChange?.(false)}
        >
          mock unbookmark
        </button>
        <button
          type="button"
          onClick={() => void onBookmarkStateChange?.(true)}
        >
          mock bookmark
        </button>
        <button
          type="button"
          onClick={() =>
            void onBookmarkStateChange?.(true, { skipRequest: true })
          }
        >
          mock bookmark without request
        </button>
      </div>
    ) : null,
}));

import { Post } from '../Post';

const bookmarkedPost: PostRecord = {
  postId: 'post-1',
  author: '작성자',
  authorHandle: 'author',
  authorProfileImageUrl: null,
  authorVerifiedBadge: false,
  game: null,
  content: '북마크 테스트 게시글',
  media: [],
  likes: 0,
  comments: 0,
  shares: 0,
  isReposted: false,
  repostCount: 0,
  likedByMe: false,
  bookmarkedByMe: true,
  mine: false,
  createdAt: '2026-09-17T00:00:00Z',
};

function openBookmarkModal(bookmarked: boolean) {
  fireEvent.click(
    screen.getByRole('button', {
      name: bookmarked ? '북마크 해제' : '북마크 저장',
    }),
  );
}

describe('Post bookmark collection synchronization', () => {
  beforeEach(() => {
    mocks.bookmarkPost.mockReset();
    mocks.deletePost.mockReset();
    mocks.unbookmarkPost.mockReset();
    mocks.bookmarkPost.mockResolvedValue(undefined);
    mocks.unbookmarkPost.mockResolvedValue(undefined);
  });

  it('게시물과 리포스트에 ISO와 한국어 절대 시각을 표시한다', () => {
    render(<Post post={{
      ...bookmarkedPost,
      reposterInfo: { userId: 'reposter', nickname: '리포스터', repostedAt: '2026-09-18T00:00:00Z' },
    }} />);
    const times = document.querySelectorAll('time');
    expect(times).toHaveLength(2);
    expect(Array.from(times, (time) => time.dateTime)).toEqual([
      '2026-09-18T00:00:00.000Z', '2026-09-17T00:00:00.000Z',
    ]);
    for (const time of times) expect(time.title).toMatch(/^2026년 9월 \d+일 (오전|오후) \d{1,2}:00$/);
  });

  it('게시물·리포스트의 빈 날짜와 잘못된 날짜도 안전한 문자열로 표시한다', () => {
    render(<Post post={{
      ...bookmarkedPost, createdAt: 'invalid',
      reposterInfo: { userId: 'reposter', nickname: '리포스터', repostedAt: '' },
    }} />);
    expect(screen.getAllByText('시간 정보 없음')).toHaveLength(2);
    expect(document.querySelector('time')).toBeNull();
  });

  it('runs delete before notifying the parent of a successful unbookmark', async () => {
    const calls: string[] = [];
    const onBookmarkSuccess = vi.fn(() => calls.push('success'));

    mocks.unbookmarkPost.mockImplementation(async () => {
      calls.push('delete');
    });
    render(
      <Post
        post={bookmarkedPost}
        onBookmarkSuccess={onBookmarkSuccess}
      />,
    );

    openBookmarkModal(true);
    fireEvent.click(screen.getByRole('button', { name: 'mock unbookmark' }));

    await waitFor(() => {
      expect(onBookmarkSuccess).toHaveBeenCalledTimes(1);
    });
    expect(calls).toEqual(['delete', 'success']);
  });

  it.each([
    [new Error('delete failed'), 'delete failed'],
    ['unknown failure', '북마크 상태를 변경하지 못했습니다.'],
  ])('rolls back only when the delete request fails (%s)', async (error, message) => {
    const onBookmarkChange = vi.fn();
    const onBookmarkSuccess = vi.fn();
    mocks.unbookmarkPost.mockRejectedValue(error);

    render(
      <Post
        post={bookmarkedPost}
        onBookmarkChange={onBookmarkChange}
        onBookmarkSuccess={onBookmarkSuccess}
      />,
    );

    openBookmarkModal(true);
    fireEvent.click(screen.getByRole('button', { name: 'mock unbookmark' }));

    await waitFor(() => {
      expect(screen.getAllByRole('alert').map((element) => element.textContent)).toContain(message);
    });
    expect(onBookmarkChange).toHaveBeenCalledTimes(2);
    expect(onBookmarkChange.mock.calls[0][1]).toBe(false);
    expect(onBookmarkChange.mock.calls[1][1]).toBe(true);
    expect(onBookmarkSuccess).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: '북마크 해제' }),
    ).toBeInTheDocument();
  });

  it('notifies the parent after adding a bookmark', async () => {
    const onBookmarkSuccess = vi.fn();
    render(
      <Post
        post={{ ...bookmarkedPost, bookmarkedByMe: false }}
        onBookmarkSuccess={onBookmarkSuccess}
      />,
    );

    openBookmarkModal(false);
    fireEvent.click(screen.getByRole('button', { name: 'mock bookmark' }));

    await waitFor(() => {
      expect(mocks.bookmarkPost).toHaveBeenCalledWith('post-1');
    });
    expect(onBookmarkSuccess).toHaveBeenCalledTimes(1);
  });

  it('preserves the skipRequest path without API calls', async () => {
    const onBookmarkSuccess = vi.fn();
    render(
      <Post
        post={{ ...bookmarkedPost, bookmarkedByMe: false }}
        onBookmarkSuccess={onBookmarkSuccess}
      />,
    );

    openBookmarkModal(false);
    fireEvent.click(
      screen.getByRole('button', { name: 'mock bookmark without request' }),
    );

    await waitFor(() => {
      expect(onBookmarkSuccess).toHaveBeenCalledTimes(1);
    });
    expect(mocks.bookmarkPost).not.toHaveBeenCalled();
    expect(mocks.unbookmarkPost).not.toHaveBeenCalled();
  });
});
