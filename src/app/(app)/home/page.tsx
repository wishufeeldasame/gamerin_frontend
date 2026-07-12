'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { PostComposer } from '@/app/home/components/PostComposer';
import { Post } from '@/app/home/components/Post';
import { RightSidebar } from '@/app/home/components/RightSidebar';
import { PostRecord, fetchFeed, likePost, unlikePost, updatePostLikeState } from '@/lib/feed-api';

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
  const [likeLoadingByPostId, setLikeLoadingByPostId] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const loadMoreControllerRef = useRef<AbortController | null>(null);

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
          setError(loadError instanceof Error ? loadError.message : 'Failed to load feed.');
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

    const optimistic = updatePostLikeState(post);
    setLikeLoadingByPostId((current) => ({ ...current, [post.postId]: true }));

    setPosts((current) =>
      current.map((item) => (item.postId === post.postId ? optimistic : item))
    );

    try {
      if (post.likedByMe) {
        await unlikePost(post.postId);
      } else {
        await likePost(post.postId);
      }
    } catch (likeError) {
      setPosts((current) =>
        current.map((item) => (item.postId === post.postId ? post : item))
      );
      alert(likeError instanceof Error ? likeError.message : 'Failed to update like.');
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

  const handleBookmarkChanged = (updatedPost: PostRecord) => {
    handlePostUpdated(updatedPost);
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((current) => current.filter((item) => item.postId !== postId));
  };

  const handleOpenPost = (postId: string, target: PostDetailTarget = 'post') => {
    const search = target === 'comments' ? '?target=comments' : '';
    router.push(`/posts/${encodeURIComponent(postId)}${search}`);
  };

  const handleLoadMore = async () => {
    if (!hasNext || !nextCursor || loadingMore) {
      return;
    }

    loadMoreControllerRef.current?.abort();
    const controller = new AbortController();
    loadMoreControllerRef.current = controller;

    try {
      setLoadingMore(true);
      const page = await fetchFeed(activeTab, nextCursor, 20, { signal: controller.signal });
      setPosts((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
      setHasNext(page.hasNext);
    } catch (loadMoreError) {
      if (loadMoreError instanceof DOMException && loadMoreError.name === 'AbortError') {
        return;
      }

      alert(loadMoreError instanceof Error ? loadMoreError.message : 'Failed to load more posts.');
    } finally {
      if (loadMoreControllerRef.current === controller) {
        loadMoreControllerRef.current = null;
        setLoadingMore(false);
      }
    }
  };

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
                    onRepostChange={handlePostUpdated}
                    onDelete={(deletedPost) => handlePostDeleted(deletedPost.postId)}
                    onBookmarkChange={handleBookmarkChanged}
                  />
                </motion.div>
              ))}

              {hasNext ? (
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full rounded-2xl border border-zinc-100 bg-white px-6 py-4 text-sm font-black text-zinc-600 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:text-zinc-300"
                >
                  {loadingMore ? '불러오는 중...' : '더 보기'}
                </button>
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
