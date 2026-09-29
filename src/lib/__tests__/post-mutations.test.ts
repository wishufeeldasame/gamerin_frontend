import { describe, expect, it } from 'vitest';
import type { PostRecord } from '@/lib/feed-api';
import {
  updatePostsBookmarkState,
  updatePostsRepostState,
} from '@/lib/post-mutations';

const post: PostRecord = {
  postId: 'post-1',
  author: 'Author',
  authorHandle: 'author',
  authorProfileImageUrl: null,
  authorVerifiedBadge: false,
  game: null,
  content: 'Bookmark mutation test',
  media: [],
  likes: 13,
  comments: 2,
  shares: 1,
  isReposted: true,
  repostCount: 5,
  likedByMe: true,
  bookmarkedByMe: false,
  isSaved: false,
  savedCollectionIds: ['collection-new'],
  mine: false,
  createdAt: '2026-09-24T00:00:00Z',
};

describe('updatePostsBookmarkState', () => {
  it('rolls back only the bookmark flag on the latest post state', () => {
    const [updated] = updatePostsBookmarkState([post], post.postId, true);

    expect(updated).toEqual({
      ...post,
      bookmarkedByMe: true,
    });
    expect(updated.likes).toBe(13);
    expect(updated.likedByMe).toBe(true);
    expect(updated.isReposted).toBe(true);
    expect(updated.repostCount).toBe(5);
    expect(updated.savedCollectionIds).toEqual(['collection-new']);
  });

  it('does not change unrelated posts', () => {
    const unrelated = {
      ...post,
      postId: 'post-2',
      bookmarkedByMe: true,
    };

    const result = updatePostsBookmarkState([post, unrelated], post.postId, true);

    expect(result[1]).toBe(unrelated);
  });

  it('keeps the bookmark count-independent fields stable when the same value is applied', () => {
    const bookmarkedPost = {
      ...post,
      bookmarkedByMe: true,
    };

    const [updated] = updatePostsBookmarkState(
      [bookmarkedPost],
      bookmarkedPost.postId,
      true,
    );

    expect(updated).toEqual(bookmarkedPost);
  });
});

describe('updatePostsRepostState', () => {
  it('keeps the latest bookmark and like fields when the callback payload is stale', () => {
    const latestPost = {
      ...post,
      bookmarkedByMe: true,
      savedCollectionIds: ['collection-latest'],
      likedByMe: true,
      likes: 14,
    };
    const staleCallbackPost = {
      ...post,
      bookmarkedByMe: false,
      savedCollectionIds: [],
      likedByMe: false,
      likes: 12,
      isReposted: false,
      repostCount: 4,
    };

    const [updated] = updatePostsRepostState(
      [latestPost],
      staleCallbackPost.postId,
      staleCallbackPost.isReposted,
      staleCallbackPost.repostCount,
    );

    expect(updated).toEqual({ ...latestPost, isReposted: false, repostCount: 4 });
  });
});
