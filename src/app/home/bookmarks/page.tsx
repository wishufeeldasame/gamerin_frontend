'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bookmark, ImageIcon, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  PostRecord,
  fetchMyBookmarks,
  likePost,
  unlikePost,
  updatePostLikeState,
} from '@/lib/feed-api';
import { Post } from '../components/Post';
import { PostDetail } from '../components/PostDetail';

type BookmarkFilter = 'all' | 'media';
type PostDetailTarget = 'post' | 'comments';

const BOOKMARK_PAGE_SIZE = 20;

const filterOptions: { value: BookmarkFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'media', label: '미디어' },
];

function HighlightedText({ text, query }: { text: string; query: string }) {
  const keyword = query.trim();
  if (!keyword) return <>{text}</>;

  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === keyword.toLowerCase() ? (
          <mark key={`${part}-${index}`} className="rounded bg-[#f5b93d]/40 px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      )}
    </>
  );
}

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<PostRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<BookmarkFilter>('all');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedPostTarget, setSelectedPostTarget] = useState<PostDetailTarget>('post');

  const upsertBookmark = useCallback((post: PostRecord) => {
    setBookmarks((current) => {
      const exists = current.some((item) => item.postId === post.postId);
      if (!exists) {
        return [post, ...current];
      }

      return current.map((item) => (item.postId === post.postId ? post : item));
    });
  }, []);

  const removeBookmark = useCallback((postId: string) => {
    setBookmarks((current) => current.filter((post) => post.postId !== postId));
  }, []);

  const loadInitialBookmarks = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setLoadingMore(false);
      setError(null);

      const page = await fetchMyBookmarks(null, BOOKMARK_PAGE_SIZE, { signal });

      if (signal?.aborted) {
        return;
      }

      setBookmarks(page.items);
      setNextCursor(page.nextCursor);
      setHasNext(page.hasNext);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') {
        return;
      }

      setError(loadError instanceof Error ? loadError.message : '북마크를 불러오지 못했습니다.');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadInitialBookmarks(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadInitialBookmarks]);

  const visibleBookmarks = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return bookmarks
      .filter((post) => {
        if (filter === 'media') return post.media.length > 0;
        return true;
      })
      .filter((post) => {
        if (!keyword) return true;

        return [
          post.author,
          post.authorHandle,
          post.game ?? '',
          post.content ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(keyword);
      });
  }, [bookmarks, filter, query]);

  const handleLoadMore = async () => {
    if (!hasNext || !nextCursor || loadingMore) {
      return;
    }

    try {
      setLoadingMore(true);
      const page = await fetchMyBookmarks(nextCursor, BOOKMARK_PAGE_SIZE);

      setBookmarks((current) => {
        const existingPostIds = new Set(current.map((post) => post.postId));
        const nextItems = page.items.filter((post) => !existingPostIds.has(post.postId));
        return [...current, ...nextItems];
      });
      setNextCursor(page.nextCursor);
      setHasNext(page.hasNext);
    } catch (loadError) {
      alert(loadError instanceof Error ? loadError.message : '북마크를 더 불러오지 못했습니다.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handlePostUpdated = (updatedPost: PostRecord) => {
    if (updatedPost.bookmarkedByMe) {
      upsertBookmark(updatedPost);
      return;
    }

    removeBookmark(updatedPost.postId);
  };

  const handleToggleLike = async (post: PostRecord) => {
    const optimistic = updatePostLikeState(post);

    setBookmarks((current) =>
      current.map((item) => (item.postId === post.postId ? optimistic : item))
    );

    try {
      if (post.likedByMe) {
        await unlikePost(post.postId);
      } else {
        await likePost(post.postId);
      }
    } catch (likeError) {
      setBookmarks((current) =>
        current.map((item) => (item.postId === post.postId ? post : item))
      );
      alert(likeError instanceof Error ? likeError.message : 'Failed to update like.');
    }
  };

  const handlePostDeleted = (postId: string) => {
    removeBookmark(postId);
    if (selectedPostId === postId) {
      setSelectedPostId(null);
      setSelectedPostTarget('post');
    }
  };

  const handleOpenPost = (postId: string, target: PostDetailTarget = 'post') => {
    setSelectedPostId(postId);
    setSelectedPostTarget(target);
  };

  if (selectedPostId) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <PostDetail
          postId={selectedPostId}
          onBack={() => {
            setSelectedPostId(null);
            setSelectedPostTarget('post');
          }}
          initialScrollTarget={selectedPostTarget === 'comments' ? 'comments' : undefined}
          onPostUpdated={handlePostUpdated}
          onPostDeleted={handlePostDeleted}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white shadow-lg">
            <Bookmark size={24} className="fill-white" />
          </div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-black">북마크</h1>
          <p className="mt-3 text-xs font-black uppercase tracking-widest text-zinc-400">
            불러온 북마크 {bookmarks.length}개
          </p>
        </div>

        <div className="w-full space-y-3 md:w-96">
          <div className="relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
              size={18}
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="게시물, 작성자, 게임 검색"
              className="w-full rounded-[20px] border-none bg-zinc-100 py-4 pl-12 pr-4 text-sm font-black text-black shadow-inner outline-none transition-all placeholder:text-zinc-400 focus:ring-2 focus:ring-black"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={`rounded-2xl px-4 py-2 text-xs font-black transition ${
                  filter === option.value ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-500 hover:text-black'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[32px] border border-zinc-100 bg-white p-10 text-center font-black text-zinc-400">
          북마크를 불러오는 중...
        </div>
      ) : error ? (
        <div className="rounded-[32px] border border-red-100 bg-red-50 p-10 text-center">
          <p className="font-black text-red-500">{error}</p>
          <button
            type="button"
            onClick={() => void loadInitialBookmarks()}
            className="mt-5 rounded-2xl bg-black px-5 py-3 text-sm font-black text-white transition hover:bg-zinc-800"
          >
            다시 시도
          </button>
        </div>
      ) : bookmarks.length === 0 ? (
        <div className="rounded-[36px] border border-dashed border-zinc-200 bg-zinc-50 px-6 py-16 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-zinc-300 shadow-sm">
            <Bookmark size={30} />
          </div>
          <h2 className="text-2xl font-black italic tracking-tight text-black">아직 저장한 게시물이 없어요</h2>
          <p className="mt-3 text-sm font-bold text-zinc-400">
            피드에서 북마크 아이콘을 누르면 이곳에 저장됩니다.
          </p>
        </div>
      ) : visibleBookmarks.length === 0 ? (
        <div className="rounded-[32px] border border-zinc-100 bg-white p-10 text-center font-black text-zinc-400">
          검색 결과가 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {visibleBookmarks.map((post, index) => (
            <motion.div
              key={post.postId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              {post.media.length > 0 ? (
                <div className="mb-2 flex flex-wrap items-center gap-2 px-2 text-[11px] font-black uppercase tracking-widest text-zinc-400">
                  <span className="flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-1 text-zinc-500">
                    <ImageIcon size={12} />
                    Media
                  </span>
                  {query.trim() ? (
                    <span className="normal-case">
                      <HighlightedText text={`${post.author} @${post.authorHandle}`} query={query} />
                    </span>
                  ) : null}
                </div>
              ) : query.trim() ? (
                <div className="mb-2 px-2 text-[11px] font-black text-zinc-400">
                  <HighlightedText text={`${post.author} @${post.authorHandle}`} query={query} />
                </div>
              ) : null}
              <Post
                post={post}
                onToggleLike={handleToggleLike}
                onOpenDetail={(selected) => handleOpenPost(selected.postId)}
                onOpenComments={(selected) => handleOpenPost(selected.postId, 'comments')}
                onShare={handlePostUpdated}
                onDelete={(deletedPost) => handlePostDeleted(deletedPost.postId)}
                onBookmarkChange={(changedPost, bookmarked) => {
                  if (bookmarked) {
                    upsertBookmark(changedPost);
                  }
                }}
                onBookmarkSuccess={(changedPost, bookmarked) => {
                  if (!bookmarked) {
                    removeBookmark(changedPost.postId);
                  }
                }}
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
  );
}
