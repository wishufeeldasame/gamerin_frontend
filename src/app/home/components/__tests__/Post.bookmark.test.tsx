import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostRecord } from '@/lib/feed-api';

const mocks = vi.hoisted(() => ({
  bookmarkPost: vi.fn(),
  deletePost: vi.fn(),
  refreshCollections: vi.fn(),
  unbookmarkPost: vi.fn(),
}));

vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => ({ user: { handle: 'viewer' } }),
}));

vi.mock('@/app/context/BookmarkCollectionContext', () => ({
  useBookmarkCollections: () => ({
    refreshCollections: mocks.refreshCollections,
  }),
}));

vi.mock('@/lib/feed-api', () => ({
  bookmarkPost: mocks.bookmarkPost,
  deletePost: mocks.deletePost,
  formatRelativeTime: () => 'now',
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
    mocks.refreshCollections.mockReset();
    mocks.unbookmarkPost.mockReset();
    mocks.bookmarkPost.mockResolvedValue(undefined);
    mocks.refreshCollections.mockResolvedValue(undefined);
    mocks.unbookmarkPost.mockResolvedValue(undefined);
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  });

  it('runs delete, success handling, and collection refresh in order', async () => {
    const calls: string[] = [];
    const onBookmarkSuccess = vi.fn(() => calls.push('success'));

    mocks.unbookmarkPost.mockImplementation(async () => {
      calls.push('delete');
    });
    mocks.refreshCollections.mockImplementation(() => {
      calls.push('refresh');
      return Promise.resolve();
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
      expect(mocks.refreshCollections).toHaveBeenCalledTimes(1);
    });
    expect(calls).toEqual(['delete', 'success', 'refresh']);
  });

  it('rolls back only when the delete request fails', async () => {
    const onBookmarkChange = vi.fn();
    const onBookmarkSuccess = vi.fn();
    mocks.unbookmarkPost.mockRejectedValue(new Error('delete failed'));

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
      expect(window.alert).toHaveBeenCalledWith('delete failed');
    });
    expect(onBookmarkChange).toHaveBeenCalledTimes(2);
    expect(onBookmarkChange.mock.calls[0][1]).toBe(false);
    expect(onBookmarkChange.mock.calls[1][1]).toBe(true);
    expect(onBookmarkSuccess).not.toHaveBeenCalled();
    expect(mocks.refreshCollections).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: '북마크 해제' }),
    ).toBeInTheDocument();
  });

  it('keeps the successful delete when collection refresh rejects', async () => {
    const onBookmarkChange = vi.fn();
    const onBookmarkSuccess = vi.fn();
    mocks.refreshCollections.mockRejectedValue(new Error('refresh failed'));

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
      expect(mocks.refreshCollections).toHaveBeenCalledTimes(1);
    });
    await Promise.resolve();

    expect(onBookmarkChange).toHaveBeenCalledTimes(1);
    expect(onBookmarkChange.mock.calls[0][1]).toBe(false);
    expect(onBookmarkSuccess).toHaveBeenCalledTimes(1);
    expect(onBookmarkSuccess.mock.calls[0][1]).toBe(false);
    expect(window.alert).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: '북마크 저장' }),
    ).toBeInTheDocument();
  });

  it('does not refresh collections after adding a bookmark', async () => {
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
    expect(mocks.refreshCollections).not.toHaveBeenCalled();
  });

  it('preserves the skipRequest path without API calls or refreshes', async () => {
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
    expect(mocks.refreshCollections).not.toHaveBeenCalled();
  });
});
