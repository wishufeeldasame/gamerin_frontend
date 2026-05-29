'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PostComposer } from './components/PostComposer';
import { Post } from './components/Post';
import { RightSidebar } from './components/RightSidebar';
import { PostDetail } from './components/PostDetail';
import { PostRecord, fetchFeed, likePost, unlikePost } from '@/lib/feed-api';

type FeedTab = 'all' | 'following';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<FeedTab>('all');
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadInitialData = async () => {
      try {
        setLoading(true);
        setError(null);
        const feedPage = await fetchFeed(activeTab);

        if (cancelled) {
          return;
        }

        setPosts(feedPage.items);
        setNextCursor(feedPage.nextCursor);
        setHasNext(feedPage.hasNext);
      } catch (loadError) {
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
    };
  }, [activeTab]);

  const handleCreatedPost = (createdPost: PostRecord) => {
    setPosts((current) => [createdPost, ...current]);
  };

  const handleToggleLike = async (post: PostRecord) => {
    const optimistic = {
      ...post,
      likedByMe: !post.likedByMe,
      likes: post.likes + (post.likedByMe ? -1 : 1),
    };

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
    }
  };

  const handlePostUpdated = (updatedPost: PostRecord) => {
    setPosts((current) =>
      current.map((item) => (item.postId === updatedPost.postId ? updatedPost : item))
    );
  };

  const handleLoadMore = async () => {
    if (!hasNext || !nextCursor || loadingMore) {
      return;
    }

    try {
      setLoadingMore(true);
      const page = await fetchFeed(activeTab, nextCursor);
      setPosts((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
      setHasNext(page.hasNext);
    } catch (loadMoreError) {
      alert(loadMoreError instanceof Error ? loadMoreError.message : 'Failed to load more posts.');
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="flex justify-center overflow-visible">
      <main className="min-h-screen max-w-2xl flex-1 border-x border-zinc-50">
        {selectedPostId ? (
          <div className="p-4">
            <PostDetail
              postId={selectedPostId}
              onBack={() => setSelectedPostId(null)}
              onPostUpdated={handlePostUpdated}
            />
          </div>
        ) : (
          <>
            <div className="sticky top-16 z-20 flex border-b border-zinc-100 bg-white/80 backdrop-blur-md">
              {[
                { label: 'For You', value: 'all' as const },
                { label: 'Following', value: 'following' as const },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`relative flex-1 py-4 text-[15px] font-black transition-all ${
                    activeTab === tab.value ? 'text-black' : 'text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.value ? (
                    <motion.div
                      layoutId="underline"
                      className="absolute bottom-0 left-1/2 h-1 w-16 -translate-x-1/2 rounded-full bg-black"
                    />
                  ) : null}
                </button>
              ))}
            </div>

            <div className="space-y-6 p-4">
              <PostComposer onCreated={handleCreatedPost} />

              {loading ? (
                <div className="rounded-[32px] border border-zinc-100 bg-white p-10 text-center font-black text-zinc-400">
                  Loading feed...
                </div>
              ) : error ? (
                <div className="rounded-[32px] border border-red-100 bg-red-50 p-10 text-center font-black text-red-500">
                  {error}
                </div>
              ) : posts.length === 0 ? (
                <div className="rounded-[32px] border border-zinc-100 bg-white p-10 text-center font-black text-zinc-400">
                  No posts in this feed yet.
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
                        onToggleLike={handleToggleLike}
                        onOpenDetail={(selected) => setSelectedPostId(selected.postId)}
                        onShare={handlePostUpdated}
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
                      {loadingMore ? 'Loading...' : 'Load More'}
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-80 p-6 xl:block">
        <RightSidebar />
      </aside>
    </div>
  );
}
