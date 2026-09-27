import { type PostRecord, updatePostBookmarkState } from '@/lib/feed-api';

export function updatePostsBookmarkState(
  posts: PostRecord[],
  postId: string,
  bookmarkedByMe: boolean,
): PostRecord[] {
  return posts.map((post) => (
    post.postId === postId ? updatePostBookmarkState(post, bookmarkedByMe) : post
  ));
}

export function updatePostsRepostState(
  posts: PostRecord[],
  postId: string,
  isReposted: boolean,
  repostCount: number,
): PostRecord[] {
  return posts.map((post) => (
    post.postId === postId
      ? { ...post, isReposted, repostCount }
      : post
  ));
}
