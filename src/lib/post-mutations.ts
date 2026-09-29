import {
  type PostRecord,
  updatePostLikeState,
} from '@/lib/feed-api';

export function updatePostsLikeState(
  posts: PostRecord[],
  postId: string,
  likedByMe: boolean,
): PostRecord[] {
  return posts.map((post) => (
    post.postId === postId ? updatePostLikeState(post, likedByMe) : post
  ));
}

export function updatePostsBookmarkState(
  posts: PostRecord[],
  postId: string,
  bookmarkedByMe: boolean,
): PostRecord[] {
  return posts.map((post) => (
    post.postId === postId ? { ...post, bookmarkedByMe } : post
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
