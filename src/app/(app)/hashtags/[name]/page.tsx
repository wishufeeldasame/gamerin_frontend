'use client';

import Link from 'next/link';
import { useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Hash } from 'lucide-react';
import { Post } from '@/app/home/components/Post';
import { PostListSkeleton } from '@/app/home/components/LoadingSkeletons';
import { RightSidebar } from '@/app/home/components/RightSidebar';
import { canGoBack } from '@/lib/history-back';
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
// 라이트에서 흰 바탕 위 yellow/500 포커스는 대비가 부족해 text/brand를 쓴다(PR #180과 같은 규칙).
const FOCUS_RING = 'focus-visible:outline-fg-brand dark:focus-visible:outline-line-focus';

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

  const goBack = () => {
    // 공유 링크로 바로 열었으면 돌아갈 기록이 없다(웹앱 독립 실행에는 브라우저 뒤로가기도 없다).
    if (canGoBack()) router.back();
    else router.replace('/home');
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-8 md:px-8">
      <div className="min-w-0 flex-1 lg:py-6">
        {/* 모바일은 앱 상단 바 대신 뒤로 헤더(F15), 데스크톱은 시안대로 제목만 둔다. */}
        <header className="sticky top-0 z-20 flex min-w-0 items-center gap-1 bg-canvas px-2 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] lg:static lg:p-0">
          <button type="button" onClick={goBack} className={`btn-icon text-icon-primary lg:hidden ${FOCUS_RING}`} aria-label="뒤로 가기">
            <ChevronLeft size={24} strokeWidth={1.67} />
          </button>
          <h1 className="page-title truncate">#{hashtagName}</h1>
        </header>
        <p className="mb-3 mt-2 px-4 text-body text-fg-secondary md:px-0 lg:mt-1 lg:mb-4">최신 게시글</p>

        <div className="px-4 pb-4 md:px-0">
          {loading ? (
            <PostListSkeleton count={3} label="게시글을 불러오는 중" />
          ) : error ? (
            <div role="alert" className="flex flex-col items-center rounded-card border border-line-card bg-surface px-6 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-icon-secondary">
                <Hash size={20} strokeWidth={1.67} aria-hidden="true" />
              </span>
              <p className="mt-4 text-body font-bold text-fg-primary">{error}</p>
              <Link href="/home" className="btn-secondary mt-6">
                홈으로 돌아가기
              </Link>
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-card border border-line-card bg-surface p-8 text-center text-body text-fg-tertiary">
              아직 이 해시태그의 게시글이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
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
                  className="btn-secondary w-full"
                >
                  {loadingMore ? '불러오는 중...' : '더보기'}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <aside className="sticky top-[var(--app-header-height)] hidden h-[calc(100vh-var(--app-header-height))] w-80 shrink-0 py-6 xl:block">
        <RightSidebar />
      </aside>
    </div>
  );
}
