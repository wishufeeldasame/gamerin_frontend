'use client';

import Link from 'next/link';
import { useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Post } from '@/app/home/components/Post';
import { useCursorList } from '@/hooks/useCursorList';
import { usePostLike } from '@/hooks/usePostLike';
import { fetchHashtagPosts } from '@/lib/community-search-api';
import { type PostRecord, getPostHref } from '@/lib/feed-api';
import {
  updatePostsBookmarkState,
  updatePostsLikeState,
  updatePostsRepostState,
} from '@/lib/post-mutations';

const HASHTAG_PAGE_SIZE = 20;

function decodeHashtagName(value: string) {
  try {
    return decodeURIComponent(value).replace(/^#/, '');
  } catch {
    return value.replace(/^#/, '');
  }
}

export default function HashtagPostsPage() {
  const router = useRouter();
  const params = useParams<{ name: string }>();
  const hashtagName = useMemo(() => decodeHashtagName(params.name ?? ''), [params.name]);
  const loadPage = useCallback((cursor: string | null, { signal }: { signal: AbortSignal }) => (
    fetchHashtagPosts(hashtagName, cursor, HASHTAG_PAGE_SIZE, { signal })
  ), [hashtagName]);
  const {
    items: posts,
    setItems: setPosts,
    nextCursor,
    hasNext,
    loading,
    loadingMore,
    error,
    loadMore: handleLoadMore,
  } = useCursorList<PostRecord>({
    loadPage,
    getKey: (post) => post.postId,
    queryKey: hashtagName,
    enabled: Boolean(hashtagName),
    initialErrorMessage: '해시태그 게시글을 불러오지 못했습니다.',
    loadMoreErrorMessage: '게시글을 더 불러오지 못했습니다.',
  });
  const applyLikeState = useCallback((postId: string, likedByMe: boolean) => {
    setPosts((current) => updatePostsLikeState(current, postId, likedByMe));
  }, [setPosts]);
  const { toggleLike: handleToggleLike, likeLoadingByPostId } = usePostLike(applyLikeState);

  const handlePostUpdated = (updatedPost: PostRecord) => {
    setPosts((current) => current.map((post) => (post.postId === updatedPost.postId ? updatedPost : post)));
  };

  const handleRepostChanged = (updatedPost: PostRecord) => {
    setPosts((current) =>
      updatePostsRepostState(
        current, updatedPost.postId, updatedPost.isReposted, updatedPost.repostCount,
      )
    );
  };

  const handleBookmarkChanged = (updatedPost: PostRecord, bookmarked = updatedPost.bookmarkedByMe) => {
    setPosts((current) => updatePostsBookmarkState(current, updatedPost.postId, bookmarked));
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((current) => current.filter((post) => post.postId !== postId));
  };

  return (
    <div className="page-container">
      <header className="mb-6 min-w-0 md:mb-8">
        <h1 className="page-title truncate">#{hashtagName}</h1>
        <p className="page-subtitle">최신 게시글</p>
      </header>

      {loading ? (
        <div className="rounded-3xl border border-zinc-100 bg-white p-10 text-center font-black text-zinc-400">
          게시글을 불러오는 중...
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-red-100 bg-red-50 p-10 text-center dark:border-red-950 dark:bg-red-950/30">
          <p className="font-black text-red-500">{error}</p>
          <Link
            href="/home"
            className="btn-primary"
          >
            홈으로 돌아가기
          </Link>
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 p-10 text-center">
          <p className="font-black text-zinc-500">아직 이 해시태그의 게시글이 없습니다.</p>
        </div>
      ) : (
        <div className="-mx-4 md:mx-0 md:space-y-4">
          {posts.map((post) => (
            <Post
              key={post.postId}
              post={post}
              likeLoading={Boolean(likeLoadingByPostId[post.postId])}
              onToggleLike={handleToggleLike}
              onOpenDetail={(selected) => router.push(getPostHref(selected.postNumber))}
              onOpenComments={(selected) => router.push(getPostHref(selected.postNumber, '?target=comments'))}
              onShare={handlePostUpdated}
              onRepostChange={handleRepostChanged}
              onBookmarkChange={handleBookmarkChanged}
              onDelete={(deletedPost) => handlePostDeleted(deletedPost.postId)}
            />
          ))}

          {hasNext && nextCursor ? (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="w-full rounded-2xl border border-zinc-100 bg-white px-6 py-4 text-sm font-black text-zinc-600 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:text-zinc-300"
            >
              {loadingMore ? '불러오는 중...' : '더보기'}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
