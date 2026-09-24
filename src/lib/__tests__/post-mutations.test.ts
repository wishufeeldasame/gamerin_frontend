import { describe, expect, it } from 'vitest';
import { type PostRecord, updatePostBookmarkState, updatePostRepostState } from '@/lib/feed-api';
import { updatePostsLikeState } from '@/lib/post-mutations';

function createPost(overrides: Partial<PostRecord> = {}): PostRecord {
  return {
    postId: 'post-1',
    author: '게이머',
    authorHandle: 'gamer',
    authorProfileImageUrl: null,
    authorVerifiedBadge: false,
    content: '게시글',
    media: [],
    likes: 3,
    comments: 0,
    shares: 0,
    isReposted: false,
    repostCount: 1,
    reposterInfo: null,
    likedByMe: false,
    bookmarkedByMe: false,
    isSaved: false,
    savedCollectionIds: [],
    mine: false,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('updatePostsLikeState', () => {
  it('대상 게시글의 좋아요 상태와 개수만 변경한다', () => {
    const post = createPost();

    const [updated] = updatePostsLikeState([post], post.postId, true);

    expect(updated).toEqual({
      ...post,
      likedByMe: true,
      likes: 4,
    });
  });

  it('좋아요를 취소하면 개수를 하나 줄인다', () => {
    const post = createPost({ likedByMe: true, likes: 3 });

    const [updated] = updatePostsLikeState([post], post.postId, false);

    expect(updated.likedByMe).toBe(false);
    expect(updated.likes).toBe(2);
  });

  it('같은 좋아요 상태를 다시 적용해도 개수를 중복 변경하지 않는다', () => {
    const post = createPost({ likedByMe: true, likes: 3 });

    const [updated] = updatePostsLikeState([post], post.postId, true);

    expect(updated.likes).toBe(3);
  });

  it('좋아요 개수를 0보다 작게 만들지 않는다', () => {
    const post = createPost({ likedByMe: true, likes: 0 });

    const [updated] = updatePostsLikeState([post], post.postId, false);

    expect(updated.likes).toBe(0);
  });

  it('대상이 아닌 게시글은 같은 객체로 유지한다', () => {
    const target = createPost();
    const other = createPost({ postId: 'post-2' });

    const [, unchanged] = updatePostsLikeState([target, other], target.postId, true);

    expect(unchanged).toBe(other);
  });

  it('좋아요 실패를 롤백해도 그사이 변경된 북마크와 리포스트 상태를 유지한다', () => {
    const initial = createPost();
    const [optimistic] = updatePostsLikeState([initial], initial.postId, true);
    const changedWhilePending = {
      ...updatePostRepostState(updatePostBookmarkState(optimistic, true), true),
      isSaved: true,
      savedCollectionIds: ['collection-1'],
      reposterInfo: {
        userId: 'user-2',
        nickname: '리포스터',
        repostedAt: '2026-01-02T00:00:00Z',
      },
    };

    const [rolledBack] = updatePostsLikeState(
      [changedWhilePending],
      initial.postId,
      initial.likedByMe,
    );

    expect(rolledBack).toMatchObject({
      likedByMe: false,
      likes: initial.likes,
      bookmarkedByMe: true,
      isSaved: true,
      savedCollectionIds: ['collection-1'],
      isReposted: true,
      repostCount: 2,
      reposterInfo: changedWhilePending.reposterInfo,
    });
  });
});
