import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostRecord } from '@/lib/feed-api';
import type { BookmarkCollection } from '@/types/bookmark';

const mocks = vi.hoisted(() => ({
  addBookmarkToCollection: vi.fn(),
  bookmarkPost: vi.fn(),
  createCollection: vi.fn(),
  createComment: vi.fn(),
  deleteComment: vi.fn(),
  deletePost: vi.fn(),
  fetchCollectionsForPost: vi.fn(),
  fetchPostComments: vi.fn(),
  fetchPostDetail: vi.fn(),
  likePost: vi.fn(),
  refreshCollections: vi.fn(),
  removeBookmarkFromCollection: vi.fn(),
  repostPost: vi.fn(),
  unbookmarkPost: vi.fn(),
  unlikePost: vi.fn(),
  unrepostPost: vi.fn(),
}));

vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => ({ user: { handle: 'viewer' } }),
}));

vi.mock('@/app/context/BookmarkCollectionContext', () => ({
  useBookmarkCollections: () => ({
    addBookmarkToCollection: mocks.addBookmarkToCollection,
    createCollection: mocks.createCollection,
    fetchCollectionsForPost: mocks.fetchCollectionsForPost,
    refreshCollections: mocks.refreshCollections,
    removeBookmarkFromCollection: mocks.removeBookmarkFromCollection,
  }),
}));

vi.mock('@/lib/feed-api', () => ({
  bookmarkPost: mocks.bookmarkPost,
  createComment: mocks.createComment,
  deleteComment: mocks.deleteComment,
  deletePost: mocks.deletePost,
  fetchPostComments: mocks.fetchPostComments,
  fetchPostDetail: mocks.fetchPostDetail,
  formatRelativeTime: () => 'now',
  getInitials: () => 'A',
  likePost: mocks.likePost,
  repostPost: mocks.repostPost,
  unbookmarkPost: mocks.unbookmarkPost,
  unlikePost: mocks.unlikePost,
  unrepostPost: mocks.unrepostPost,
  updatePostBookmarkState: (post: PostRecord, bookmarkedByMe: boolean) => ({
    ...post,
    bookmarkedByMe,
  }),
  updatePostLikeState: (post: PostRecord) => ({
    ...post,
    likedByMe: !post.likedByMe,
    likes: Math.max(0, post.likes + (post.likedByMe ? -1 : 1)),
  }),
}));

import { PostDetail } from '../PostDetail';

const BOOKMARK_REMOVE_LABEL = '\uBD81\uB9C8\uD06C \uD574\uC81C';
const BOOKMARK_SAVE_LABEL = '\uBD81\uB9C8\uD06C \uC800\uC7A5';
const REMOVE_ALL_LABEL = '\uC804\uCCB4 \uBD81\uB9C8\uD06C \uD574\uC81C';
const COLLECTION_NAME = 'Collection A';

const bookmarkedPost: PostRecord = {
  postId: 'post-1',
  author: 'Author',
  authorHandle: 'author',
  authorProfileImageUrl: null,
  authorVerifiedBadge: false,
  game: null,
  content: 'Bookmark detail test post',
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

const selectedCollection: BookmarkCollection = {
  collectionId: 'collection-a',
  name: COLLECTION_NAME,
  coverImageUrl: null,
  bookmarkCount: 3,
  containsPost: true,
  createdAt: '2026-09-17T00:00:00Z',
  updatedAt: '2026-09-17T00:00:00Z',
};

async function renderDetail({
  post = bookmarkedPost,
  collections = [selectedCollection],
}: {
  post?: PostRecord;
  collections?: BookmarkCollection[];
} = {}) {
  mocks.fetchPostDetail.mockResolvedValue(post);
  mocks.fetchCollectionsForPost.mockResolvedValue(collections);

  render(<PostDetail postId={post.postId} onBack={vi.fn()} />);

  const bookmarkButton = await screen.findByRole('button', {
    name: post.bookmarkedByMe ? BOOKMARK_REMOVE_LABEL : BOOKMARK_SAVE_LABEL,
  });
  fireEvent.click(bookmarkButton);
  await screen.findByRole('dialog');
  await screen.findByRole('checkbox', {
    name: COLLECTION_NAME,
  });
}

describe('PostDetail bookmark collection synchronization', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    mocks.addBookmarkToCollection.mockResolvedValue(undefined);
    mocks.bookmarkPost.mockResolvedValue(undefined);
    mocks.fetchPostComments.mockResolvedValue([]);
    mocks.refreshCollections.mockResolvedValue(undefined);
    mocks.removeBookmarkFromCollection.mockResolvedValue(undefined);
    mocks.unbookmarkPost.mockResolvedValue(undefined);
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  });

  it('disables remove all until the initial collection request settles', async () => {
    let resolveCollections!: (collections: BookmarkCollection[]) => void;
    mocks.fetchPostDetail.mockResolvedValue(bookmarkedPost);
    mocks.fetchCollectionsForPost.mockReturnValue(
      new Promise<BookmarkCollection[]>((resolve) => {
        resolveCollections = resolve;
      }),
    );

    render(<PostDetail postId="post-1" onBack={vi.fn()} />);

    const bookmarkButton = await screen.findByRole('button', {
      name: BOOKMARK_REMOVE_LABEL,
    });
    fireEvent.click(bookmarkButton);
    await screen.findByRole('dialog');

    const removeAllButton = screen.getByRole('button', {
      name: REMOVE_ALL_LABEL,
    });
    expect(removeAllButton).toBeDisabled();
    fireEvent.click(removeAllButton);
    expect(mocks.unbookmarkPost).not.toHaveBeenCalled();

    await act(async () => {
      resolveCollections([selectedCollection]);
    });
    await waitFor(() => {
      expect(removeAllButton).toBeEnabled();
    });

    fireEvent.click(removeAllButton);
    await waitFor(() => {
      expect(mocks.unbookmarkPost).toHaveBeenCalledWith('post-1');
      expect(mocks.refreshCollections).toHaveBeenCalledTimes(1);
    });
  });

  it('refreshes collections after removing all bookmarks', async () => {
    const calls: string[] = [];
    mocks.unbookmarkPost.mockImplementation(async () => {
      calls.push('delete');
    });
    mocks.refreshCollections.mockImplementation(() => {
      calls.push('refresh');
      return Promise.resolve();
    });

    await renderDetail();
    fireEvent.click(screen.getByRole('button', { name: REMOVE_ALL_LABEL }));

    await waitFor(() => {
      expect(mocks.refreshCollections).toHaveBeenCalledTimes(1);
    });
    expect(calls).toEqual(['delete', 'refresh']);
    expect(mocks.unbookmarkPost).toHaveBeenCalledWith('post-1');
    expect(
      screen.getByRole('button', { name: BOOKMARK_SAVE_LABEL }),
    ).toBeInTheDocument();
  });

  it('refreshes collections after unchecking the last selected collection', async () => {
    await renderDetail();
    const checkbox = await screen.findByRole('checkbox', {
      name: COLLECTION_NAME,
    });
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(mocks.refreshCollections).toHaveBeenCalledTimes(1);
    });
    expect(mocks.unbookmarkPost).toHaveBeenCalledWith('post-1');
    expect(mocks.removeBookmarkFromCollection).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: BOOKMARK_SAVE_LABEL }),
    ).toBeInTheDocument();
  });

  it('rolls back the detail state and leaves collections unchanged when delete fails', async () => {
    mocks.unbookmarkPost.mockRejectedValue(new Error('delete failed'));

    await renderDetail();
    fireEvent.click(screen.getByRole('button', { name: REMOVE_ALL_LABEL }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('delete failed');
    });
    expect(mocks.refreshCollections).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: BOOKMARK_REMOVE_LABEL }),
    ).toBeInTheDocument();
  });

  it('keeps the successful delete when refreshing collections fails', async () => {
    mocks.refreshCollections.mockRejectedValue(new Error('refresh failed'));

    await renderDetail();
    fireEvent.click(screen.getByRole('button', { name: REMOVE_ALL_LABEL }));

    await waitFor(() => {
      expect(mocks.refreshCollections).toHaveBeenCalledTimes(1);
    });
    expect(window.alert).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: BOOKMARK_SAVE_LABEL }),
    ).toBeInTheDocument();
  });

  it('does not refresh all collections when adding to a collection', async () => {
    await renderDetail({
      post: { ...bookmarkedPost, bookmarkedByMe: false },
      collections: [{ ...selectedCollection, containsPost: false, bookmarkCount: 2 }],
    });
    const checkbox = await screen.findByRole('checkbox', {
      name: COLLECTION_NAME,
    });
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(mocks.addBookmarkToCollection).toHaveBeenCalledWith(
        'collection-a',
        'post-1',
      );
    });
    expect(mocks.bookmarkPost).not.toHaveBeenCalled();
    expect(mocks.unbookmarkPost).not.toHaveBeenCalled();
    expect(mocks.refreshCollections).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: BOOKMARK_REMOVE_LABEL }),
    ).toBeInTheDocument();
  });
});
