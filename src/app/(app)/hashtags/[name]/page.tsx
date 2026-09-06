'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Hash } from 'lucide-react';
import { Post } from '@/app/home/components/Post';
import { fetchHashtagPosts } from '@/lib/community-search-api';
import {
  type PostRecord,
  likePost,
  unlikePost,
  updatePostLikeState,
} from '@/lib/feed-api';

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
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [likeLoadingByPostId, setLikeLoadingByPostId] = useState<Record<string, boolean>>({});
  const loadControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    loadControllerRef.current?.abort();
    loadControllerRef.current = controller;

    const loadInitialPosts = async () => {
      if (!hashtagName) {
        setPosts([]);
        setNextCursor(null);
        setHasNext(false);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const page = await fetchHashtagPosts(hashtagName, null, HASHTAG_PAGE_SIZE, {
          signal: controller.signal,
        });

        setPosts(page.items);
        setNextCursor(page.nextCursor);
        setHasNext(page.hasNext);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : '해시태그 게시글을 불러오지 못했습니다.');
      } finally {
        if (loadControllerRef.current === controller) {
          loadControllerRef.current = null;
          setLoading(false);
        }
      }
    };

    void loadInitialPosts();

    return () => {
      controller.abort();
    };
  }, [hashtagName]);

  const handleLoadMore = async () => {
    if (!hasNext || !nextCursor || loadingMore) {
      return;
    }

    try {
      setLoadingMore(true);
      const page = await fetchHashtagPosts(hashtagName, nextCursor, HASHTAG_PAGE_SIZE);
      setPosts((current) => {
        const seen = new Set(current.map((post) => post.postId));
        return [...current, ...page.items.filter((post) => !seen.has(post.postId))];
      });
      setNextCursor(page.nextCursor);
      setHasNext(page.hasNext);
    } catch (loadError) {
      alert(loadError instanceof Error ? loadError.message : '게시글을 더 불러오지 못했습니다.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleToggleLike = async (post: PostRecord) => {
    if (likeLoadingByPostId[post.postId]) {
      return;
    }

    const optimistic = updatePostLikeState(post);
    setLikeLoadingByPostId((current) => ({ ...current, [post.postId]: true }));
    setPosts((current) => current.map((item) => (item.postId === post.postId ? optimistic : item)));

    try {
      if (post.likedByMe) {
        await unlikePost(post.postId);
      } else {
        await likePost(post.postId);
      }
    } catch (likeError) {
      setPosts((current) => current.map((item) => (item.postId === post.postId ? post : item)));
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
    setPosts((current) => current.map((post) => (post.postId === updatedPost.postId ? updatedPost : post)));
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((current) => current.filter((post) => post.postId !== postId));
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-8 rounded-[32px] border border-zinc-100 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
            <Hash size={24} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-black text-black dark:text-zinc-100">#{hashtagName}</h1>
            <p className="mt-1 text-xs font-black uppercase tracking-widest text-zinc-400">
              최신 게시글
            </p>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="rounded-[32px] border border-zinc-100 bg-white p-10 text-center font-black text-zinc-400">
          게시글을 불러오는 중...
        </div>
      ) : error ? (
        <div className="rounded-[32px] border border-red-100 bg-red-50 p-10 text-center">
          <p className="font-black text-red-500">{error}</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-[32px] border border-dashed border-zinc-200 bg-zinc-50 p-10 text-center">
          <p className="font-black text-zinc-500">아직 이 해시태그의 게시글이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Post
              key={post.postId}
              post={post}
              likeLoading={Boolean(likeLoadingByPostId[post.postId])}
              onToggleLike={handleToggleLike}
              onOpenDetail={(selected) => router.push(`/posts/${encodeURIComponent(selected.postId)}`)}
              onOpenComments={(selected) => router.push(`/posts/${encodeURIComponent(selected.postId)}?target=comments`)}
              onShare={handlePostUpdated}
              onRepostChange={handlePostUpdated}
              onBookmarkChange={handlePostUpdated}
              onDelete={(deletedPost) => handlePostDeleted(deletedPost.postId)}
            />
          ))}

          {hasNext ? (
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
