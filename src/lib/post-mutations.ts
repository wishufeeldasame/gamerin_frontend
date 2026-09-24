import { type PostRecord, updatePostLikeState } from '@/lib/feed-api';

export function updatePostsLikeState(
  posts: PostRecord[],
  postId: string,
  likedByMe: boolean,
): PostRecord[] {
  return posts.map((post) => (
    post.postId === postId ? updatePostLikeState(post, likedByMe) : post
  ));
}
