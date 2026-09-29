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

const BOOKMARK_REMOVE_LABEL = '북마크 해제';
const BOOKMARK_SAVE_LABEL = '북마크 저장';
const REMOVE_ALL_LABEL = '전체 북마크 해제';
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
    mocks.likePost.mockResolvedValue(undefined);
    mocks.fetchPostComments.mockResolvedValue([]);
    mocks.refreshCollections.mockResolvedValue(undefined);
    mocks.removeBookmarkFromCollection.mockResolvedValue(undefined);
    mocks.unbookmarkPost.mockResolvedValue(undefined);
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  });

  it('disables remove all while collections load, then sends one delete', async () => {
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
    expect(mocks.unbookmarkPost).not.toHaveBeenCalled();

    await act(async () => {
      resolveCollections([selectedCollection]);
    });
    await waitFor(() => {
      expect(removeAllButton).toBeEnabled();
    });

    fireEvent.click(removeAllButton);
    await waitFor(() => {
      expect(mocks.unbookmarkPost).toHaveBeenCalledTimes(1);
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


  it('keeps a successful like when a pending bookmark delete fails', async () => {
    let rejectDelete!: (reason?: unknown) => void;
    const onPostUpdated = vi.fn();
    const postWithConcurrentState: PostRecord = {
      ...bookmarkedPost,
      likes: 12,
      savedCollectionIds: ['collection-a'],
    };

    mocks.fetchPostDetail.mockResolvedValue(postWithConcurrentState);
    mocks.fetchCollectionsForPost.mockResolvedValue([selectedCollection]);
    mocks.unbookmarkPost.mockReturnValue(
      new Promise<void>((_resolve, reject) => {
        rejectDelete = reject;
      }),
    );

    render(
      <PostDetail
        postId="post-1"
        onBack={vi.fn()}
        onPostUpdated={onPostUpdated}
      />,
    );

    const bookmarkButton = await screen.findByRole('button', {
      name: BOOKMARK_REMOVE_LABEL,
    });
    fireEvent.click(bookmarkButton);
    await screen.findByRole('dialog');
    await screen.findByRole('checkbox', {
      name: COLLECTION_NAME,
    });

    fireEvent.click(screen.getByRole('button', { name: REMOVE_ALL_LABEL }));
    await waitFor(() => {
      expect(mocks.unbookmarkPost).toHaveBeenCalledWith('post-1');
    });

    fireEvent.click(screen.getByRole('button', { name: '12' }));
    await waitFor(() => {
      expect(mocks.likePost).toHaveBeenCalledWith('post-1');
      expect(screen.getByRole('button', { name: '13' })).toBeInTheDocument();
    });

    await act(async () => {
      rejectDelete(new Error('delete failed'));
    });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('delete failed');
    });
    expect(screen.getByRole('button', { name: '13' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: BOOKMARK_REMOVE_LABEL }),
    ).toBeInTheDocument();

    const rollbackPost = onPostUpdated.mock.calls.at(-1)?.[0] as PostRecord;
    expect(rollbackPost).toMatchObject({
      likedByMe: true,
      likes: 13,
      bookmarkedByMe: true,
      savedCollectionIds: ['collection-a'],
    });
    expect(mocks.refreshCollections).not.toHaveBeenCalled();
  });

  it('keeps bookmark rollback and a later repost success when responses finish out of order', async () => {
    let rejectDelete!: (reason?: unknown) => void;
    let resolveRepost!: (value: {
      postId: string;
      isReposted: boolean;
      repostCount: number;
    }) => void;
    const onPostUpdated = vi.fn();
    const postWithConcurrentState: PostRecord = {
      ...bookmarkedPost,
      repostCount: 5,
      savedCollectionIds: ['collection-a'],
    };

    mocks.fetchPostDetail.mockResolvedValue(postWithConcurrentState);
    mocks.fetchCollectionsForPost.mockResolvedValue([selectedCollection]);
    mocks.unbookmarkPost.mockReturnValue(
      new Promise<void>((_resolve, reject) => {
        rejectDelete = reject;
      }),
    );
    mocks.repostPost.mockReturnValue(
      new Promise((resolve) => {
        resolveRepost = resolve;
      }),
    );

    render(
      <PostDetail
        postId="post-1"
        onBack={vi.fn()}
        onPostUpdated={onPostUpdated}
      />,
    );

    fireEvent.click(await screen.findByRole('button', {
      name: BOOKMARK_REMOVE_LABEL,
    }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: REMOVE_ALL_LABEL }));
    await waitFor(() => {
      expect(mocks.unbookmarkPost).toHaveBeenCalledWith('post-1');
    });

    fireEvent.click(screen.getByRole('button', { name: '리포스트' }));
    await waitFor(() => {
      expect(mocks.repostPost).toHaveBeenCalledWith('post-1');
    });

    await act(async () => {
      rejectDelete(new Error('delete failed'));
    });
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('delete failed');
    });

    await act(async () => {
      resolveRepost({
        postId: 'post-1',
        isReposted: true,
        repostCount: 6,
      });
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: BOOKMARK_REMOVE_LABEL })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '리포스트 취소' })).toBeInTheDocument();
    });
    const confirmedPost = onPostUpdated.mock.calls.at(-1)?.[0] as PostRecord;
    expect(confirmedPost).toMatchObject({
      bookmarkedByMe: true,
      savedCollectionIds: ['collection-a'],
      isReposted: true,
      repostCount: 6,
    });
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
