import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostRecord } from '@/lib/feed-api';
import type { BookmarkCollection } from '@/types/bookmark';

const api = vi.hoisted(() => ({
  fetchCollectionBookmarks: vi.fn(),
  fetchMyBookmarks: vi.fn(),
  likePost: vi.fn(),
  unlikePost: vi.fn(),
}));

const bookmarkContext = vi.hoisted(() => ({
  collections: [] as BookmarkCollection[],
  loading: false,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/app/context/BookmarkCollectionContext', () => ({
  useBookmarkCollections: () => ({
    collections: bookmarkContext.collections,
    loading: bookmarkContext.loading,
  }),
}));

vi.mock('@/lib/feed-api', () => ({
  fetchCollectionBookmarks: api.fetchCollectionBookmarks,
  fetchMyBookmarks: api.fetchMyBookmarks,
  likePost: api.likePost,
  unlikePost: api.unlikePost,
  updatePostLikeState: (post: PostRecord) => post,
}));

vi.mock('@/app/home/components/Post', () => ({
  Post: ({
    post,
    onBookmarkSuccess,
  }: {
    post: PostRecord;
    onBookmarkSuccess?: (post: PostRecord, bookmarked: boolean) => void;
  }) => (
    <div data-testid={'post-' + post.postId}>
      <button
        type="button"
        onClick={() => onBookmarkSuccess?.(post, false)}
      >
        complete unbookmark
      </button>
      <button
        type="button"
        onClick={() => onBookmarkSuccess?.(post, true)}
      >
        complete bookmark
      </button>
    </div>
  ),
}));

import BookmarksPage from '../page';

const post: PostRecord = {
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

const initialCollections: BookmarkCollection[] = [
  {
    collectionId: 'collection-a',
    name: '모음집 A',
    coverImageUrl: null,
    bookmarkCount: 5,
    createdAt: '2026-09-17T00:00:00Z',
    updatedAt: '2026-09-17T00:00:00Z',
  },
  {
    collectionId: 'collection-b',
    name: '모음집 B',
    coverImageUrl: null,
    bookmarkCount: 4,
    createdAt: '2026-09-17T00:00:00Z',
    updatedAt: '2026-09-17T00:00:00Z',
  },
];

const pageWithPost = {
  items: [post],
  nextCursor: null,
  hasNext: false,
};

function getCollectionButton(name: string) {
  return screen.getByRole('button', { name: new RegExp(name) });
}

async function selectCollection(name: string) {
  fireEvent.click(getCollectionButton(name));
  await waitFor(() => {
    expect(api.fetchCollectionBookmarks).toHaveBeenCalled();
    expect(screen.getByTestId('post-post-1')).toBeInTheDocument();
  });
}

describe('BookmarksPage collection count synchronization', () => {
  beforeEach(() => {
    api.fetchCollectionBookmarks.mockReset();
    api.fetchMyBookmarks.mockReset();
    api.likePost.mockReset();
    api.unlikePost.mockReset();
    bookmarkContext.collections = initialCollections;
    bookmarkContext.loading = false;
    api.fetchCollectionBookmarks.mockResolvedValue(pageWithPost);
    api.fetchMyBookmarks.mockResolvedValue(pageWithPost);
    api.likePost.mockResolvedValue(undefined);
    api.unlikePost.mockResolvedValue(undefined);
  });

  it('hides stale counts until refreshed collections replace the previous array', async () => {
    const { rerender } = render(<BookmarksPage />);
    await screen.findByTestId('post-post-1');

    await selectCollection('모음집 A');
    await waitFor(() => {
      expect(
        within(getCollectionButton('모음집 A')).getByText('1개 게시물'),
      ).toBeInTheDocument();
    });

    await selectCollection('모음집 B');
    await waitFor(() => {
      expect(
        within(getCollectionButton('모음집 B')).getByText('1개 게시물'),
      ).toBeInTheDocument();
    });

    await selectCollection('모음집 A');
    fireEvent.click(
      within(screen.getByTestId('post-post-1')).getByRole('button', {
        name: 'complete unbookmark',
      }),
    );

    expect(screen.queryByTestId('post-post-1')).not.toBeInTheDocument();
    expect(screen.getAllByText('동기화 중')).toHaveLength(2);
    expect(
      within(getCollectionButton('모음집 A')).queryByText('1개 게시물'),
    ).not.toBeInTheDocument();
    expect(
      within(getCollectionButton('모음집 B')).queryByText('1개 게시물'),
    ).not.toBeInTheDocument();

    bookmarkContext.collections = [
      { ...initialCollections[0], bookmarkCount: 4 },
      { ...initialCollections[1], bookmarkCount: 3 },
    ];
    rerender(<BookmarksPage />);

    await waitFor(() => {
      expect(
        within(getCollectionButton('모음집 A')).getByText('4개 게시물'),
      ).toBeInTheDocument();
      expect(
        within(getCollectionButton('모음집 B')).getByText('3개 게시물'),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText('동기화 중')).not.toBeInTheDocument();
  });

  it('does not invalidate collection counts after bookmark success', async () => {
    render(<BookmarksPage />);
    await screen.findByTestId('post-post-1');
    await selectCollection('모음집 A');

    fireEvent.click(
      within(screen.getByTestId('post-post-1')).getByRole('button', {
        name: 'complete bookmark',
      }),
    );

    expect(screen.queryByText('동기화 중')).not.toBeInTheDocument();
    expect(
      within(getCollectionButton('모음집 A')).getByText('1개 게시물'),
    ).toBeInTheDocument();
  });
});
