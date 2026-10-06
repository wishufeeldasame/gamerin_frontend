'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { PostComposer } from '@/app/home/components/PostComposer';
import { Post } from '@/app/home/components/Post';
import { RightSidebar } from '@/app/home/components/RightSidebar';
import { PostRecord, fetchFeed, likePost, unlikePost } from '@/lib/feed-api';
import {
  updatePostsBookmarkState,
  updatePostsLikeState,
  updatePostsRepostState,
} from '@/lib/post-mutations';

type FeedTab = 'all' | 'following';
type PostDetailTarget = 'post' | 'comments';

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<FeedTab>('all');
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [likeLoadingByPostId, setLikeLoadingByPostId] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const loadMoreControllerRef = useRef<AbortController | null>(null);
  const loadMoreBlockedRef = useRef(false);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const postId = searchParams.get('postId');
    if (!postId) return;

    const target = searchParams.get('target') === 'comments' ? '?target=comments' : '';
    router.replace(`/posts/${encodeURIComponent(postId)}${target}`);
  }, [router, searchParams]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadInitialData = async () => {
      try {
        setLoading(true);
        setLoadingMore(false);
        setLoadMoreError(null);
        loadMoreBlockedRef.current = false;
        setError(null);

        const feedPage = await fetchFeed(activeTab, null, 20, { signal: controller.signal });

        if (cancelled) {
          return;
        }

        setPosts(feedPage.items);
        setNextCursor(feedPage.nextCursor);
        setHasNext(feedPage.hasNext);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return;
        }

        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '피드를 불러오지 못했습니다.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadInitialData();

    return () => {
      cancelled = true;
      controller.abort();
      loadMoreControllerRef.current?.abort();
      loadMoreControllerRef.current = null;
    };
  }, [activeTab]);

  const handleCreatedPost = (createdPost: PostRecord) => {
    setPosts((current) => [createdPost, ...current]);
  };

  const handleToggleLike = async (post: PostRecord) => {
    if (likeLoadingByPostId[post.postId]) {
      return;
    }

    setLikeLoadingByPostId((current) => ({ ...current, [post.postId]: true }));
    setPosts((current) => updatePostsLikeState(current, post.postId, !post.likedByMe));

    try {
      if (post.likedByMe) {
        await unlikePost(post.postId);
      } else {
        await likePost(post.postId);
      }
    } catch (likeError) {
      setPosts((current) => updatePostsLikeState(current, post.postId, post.likedByMe));
      alert(likeError instanceof Error ? likeError.message : '좋아요 상태를 변경하지 못했습니다.');
    } finally {
      setLikeLoadingByPostId((current) => {
        const next = { ...current };
        delete next[post.postId];
        return next;
      });
    }
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

  const handleLoadMore = useCallback(async () => {
    if (!hasNext || !nextCursor || loadMoreBlockedRef.current || loadMoreControllerRef.current) {
      return;
    }

    const controller = new AbortController();
    loadMoreControllerRef.current = controller;

    try {
      setLoadingMore(true);
      const page = await fetchFeed(activeTab, nextCursor, 20, { signal: controller.signal });
      setPosts((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
      setHasNext(page.hasNext);
      loadMoreBlockedRef.current = false;
      setLoadMoreError(null);
    } catch (loadMoreError) {
      if (loadMoreError instanceof DOMException && loadMoreError.name === 'AbortError') {
        return;
      }

      loadMoreBlockedRef.current = true;
      setLoadMoreError(
        loadMoreError instanceof Error ? loadMoreError.message : '게시물을 더 불러오지 못했습니다.',
      );

    } finally {
      if (loadMoreControllerRef.current === controller) {
        loadMoreControllerRef.current = null;
        setLoadingMore(false);
      }
    }
  }, [activeTab, hasNext, nextCursor]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasNext || !nextCursor || loadMoreError) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void handleLoadMore();
        }
      },
      { rootMargin: '400px 0px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleLoadMore, hasNext, loadMoreError, nextCursor]);

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
              onClick={() => setActiveTab(tab.value)}
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

              {hasNext ? (
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
                    onClick={() => {
                      loadMoreBlockedRef.current = false;
                      setLoadMoreError(null);
                    }}
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
