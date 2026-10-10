'use client';

import { Suspense, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { PostComposer } from '@/app/home/components/PostComposer';
import { Post } from '@/app/home/components/Post';
import { RightSidebar } from '@/app/home/components/RightSidebar';
import { useCursorList } from '@/hooks/useCursorList';
import { usePostLike } from '@/hooks/usePostLike';
import { type PostRecord, fetchFeed } from '@/lib/feed-api';
import {
  updatePostsBookmarkState,
  updatePostsLikeState,
  updatePostsRepostState,
} from '@/lib/post-mutations';

type FeedTab = 'all' | 'following';
type PostDetailTarget = 'post' | 'comments';

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab: FeedTab = searchParams.get('tab') === 'following' ? 'following' : 'all';
  const legacyPostId = searchParams.get('postId');
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  const loadPage = useCallback((cursor: string | null, { signal }: { signal: AbortSignal }) => (
    fetchFeed(activeTab, cursor, 20, { signal })
  ), [activeTab]);

  const {
    items: posts,
    setItems: setPosts,
    nextCursor,
    hasNext,
    loading,
    loadingMore,
    error,
    loadMoreError,
    loadMore,
  } = useCursorList<PostRecord>({
    loadPage,
    getKey: (post) => post.postId,
    queryKey: activeTab,
    enabled: !legacyPostId,
    initialErrorMessage: '피드를 불러오지 못했습니다.',
    loadMoreErrorMessage: '게시물을 더 불러오지 못했습니다.',
  });
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;
  const loadMoreErrorRef = useRef(loadMoreError);
  loadMoreErrorRef.current = loadMoreError;
  const handleAutoLoadMore = useCallback(() => {
    if (loadMoreErrorRef.current) return;
    void loadMoreRef.current();
  }, []);

  const applyLikeState = useCallback((postId: string, likedByMe: boolean) => {
    setPosts((current) => updatePostsLikeState(current, postId, likedByMe));
  }, [setPosts]);
  const { toggleLike: handleToggleLike, likeLoadingByPostId } = usePostLike(applyLikeState);

  useEffect(() => {
    if (!legacyPostId) return;

    const target = searchParams.get('target') === 'comments' ? '?target=comments' : '';
    router.replace(`/posts/${encodeURIComponent(legacyPostId)}${target}`);
  }, [legacyPostId, router, searchParams]);

  const handleTabChange = (tab: FeedTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('postId');
    params.delete('target');
    if (tab === 'following') {
      params.set('tab', 'following');
    } else {
      params.delete('tab');
    }

    const nextSearch = params.toString();
    router.push(`/home${nextSearch ? `?${nextSearch}` : ''}`, { scroll: false });
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  const handleCreatedPost = (createdPost: PostRecord) => {
    setPosts((current) => [createdPost, ...current]);
  };

  const handlePostUpdated = (updatedPost: PostRecord) => {
    setPosts((current) =>
      current.map((item) => (item.postId === updatedPost.postId ? updatedPost : item))
    );
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
    setPosts((current) => current.filter((item) => item.postId !== postId));
  };

  const handleOpenPost = (postId: string, target: PostDetailTarget = 'post') => {
    const search = target === 'comments' ? '?target=comments' : '';
    router.push(`/posts/${encodeURIComponent(postId)}${search}`);
  };

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasNext || !nextCursor || loadMoreError) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          handleAutoLoadMore();
        }
      },
      { rootMargin: '400px 0px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleAutoLoadMore, hasNext, loadMoreError, nextCursor]);

  return (
    <div className="flex justify-center overflow-visible">
      <main className="min-h-screen max-w-2xl flex-1 border-x border-zinc-50 dark:border-neutral-800">
        <div className="sticky top-16 z-20 flex border-b border-zinc-100 bg-white/80 backdrop-blur-md dark:border-purple-500/30 dark:bg-purple-700">
          {[
            { label: '추천', value: 'all' as const },
            { label: '팔로잉', value: 'following' as const },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleTabChange(tab.value)}
              aria-pressed={activeTab === tab.value}
              className={`relative flex-1 py-4 text-[15px] font-black transition-all ${
                activeTab === tab.value ? 'text-black dark:text-[#f5b93d]' : 'text-zinc-400 hover:text-zinc-600 dark:text-purple-200/70 dark:hover:text-white'
              }`}
            >
              {tab.label}
              {activeTab === tab.value ? (
                <motion.div
                  layoutId="underline"
                  className="absolute bottom-0 left-1/2 h-1 w-16 -translate-x-1/2 rounded-full bg-black dark:bg-[#f5b93d]"
                />
              ) : null}
            </button>
          ))}
        </div>

        <div className="space-y-6 p-4">
          <PostComposer onCreated={handleCreatedPost} />

          {loading ? (
            <div className="rounded-[32px] border border-zinc-100 bg-white p-10 text-center font-black text-zinc-400">
              피드를 불러오는 중...
            </div>
          ) : error ? (
            <div className="rounded-[32px] border border-red-100 bg-red-50 p-10 text-center font-black text-red-500">
              {error}
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-[32px] border border-zinc-100 bg-white p-10 text-center font-black text-zinc-400">
              아직 게시글이 없습니다.
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post, index) => (
                <motion.div
                  key={post.postId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <Post
                    post={post}
                    likeLoading={Boolean(likeLoadingByPostId[post.postId])}
                    onToggleLike={handleToggleLike}
                    onOpenDetail={(selected) => handleOpenPost(selected.postId)}
                    onOpenComments={(selected) => handleOpenPost(selected.postId, 'comments')}
                    onShare={handlePostUpdated}
                    onRepostChange={handleRepostChanged}
                    onDelete={(deletedPost) => handlePostDeleted(deletedPost.postId)}
                    onBookmarkChange={handleBookmarkChanged}
                  />
                </motion.div>
              ))}

              {hasNext && nextCursor ? (
                <div
                  ref={loadMoreSentinelRef}
                  data-testid="feed-load-more-sentinel"
                  aria-hidden="true"
                  className="h-px"
                />
              ) : null}

              {loadingMore ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="py-4 text-center text-sm font-bold text-zinc-400 dark:text-purple-200/70"
                >
                  게시물을 불러오는 중...
                </div>
              ) : null}

              {loadMoreError ? (
                <div
                  role="alert"
                  className="flex items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600"
                >
                  <span>{loadMoreError}</span>
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    className="shrink-0 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-600 transition hover:border-red-400"
                  >
                    다시 시도
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </main>

      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-80 p-6 xl:block">
        <RightSidebar />
      </aside>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  );
}
