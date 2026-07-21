'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bookmark, Folder, ImageIcon, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  fetchCollectionBookmarks,
  fetchMyBookmarks,
  likePost,
  unlikePost,
  updatePostLikeState,
} from '@/lib/feed-api';
import type { BookmarkScope, PostRecord } from '@/lib/feed-api';
import { Post } from '@/app/home/components/Post';
import { useBookmarkCollections } from '@/app/context/BookmarkCollectionContext';

type PostDetailTarget = 'post' | 'comments';

const BOOKMARK_PAGE_SIZE = 20;
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
  const router = useRouter();
  const { collections, loading: collectionsLoading } = useBookmarkCollections();
  const [bookmarks, setBookmarks] = useState<PostRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [mediaOnly, setMediaOnly] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('all');
  const [collectionCountOverrides, setCollectionCountOverrides] = useState<Record<string, number>>({});
  const [likeLoadingByPostId, setLikeLoadingByPostId] = useState<Record<string, boolean>>({});

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

      const requestOptions = {
        signal,
        q: query,
        mediaOnly,
      };
      const page =
        selectedCollectionId === 'all' || selectedCollectionId === 'unclassified'
          ? await fetchMyBookmarks(
              null,
              BOOKMARK_PAGE_SIZE,
              requestOptions,
              selectedCollectionId as BookmarkScope,
            )
          : await fetchCollectionBookmarks(
              selectedCollectionId,
              null,
              BOOKMARK_PAGE_SIZE,
              requestOptions,
            );

      if (signal?.aborted) {
        return;
      }

      setBookmarks(page.items);
      setNextCursor(page.nextCursor);
      setHasNext(page.hasNext);

      if (selectedCollectionId !== 'all' && selectedCollectionId !== 'unclassified') {
        setCollectionCountOverrides((current) => ({
          ...current,
          [selectedCollectionId]: page.hasNext ? Math.max(page.items.length, current[selectedCollectionId] ?? 0) : page.items.length,
        }));
      }
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
  }, [mediaOnly, query, selectedCollectionId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadInitialBookmarks(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadInitialBookmarks]);

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.collectionId === selectedCollectionId),
    [collections, selectedCollectionId],
  );

  const handleLoadMore = async () => {
    if (!hasNext || !nextCursor || loadingMore) {
      return;
    }

    try {
      setLoadingMore(true);
      const requestOptions = {
        q: query,
        mediaOnly,
      };
      const page =
        selectedCollectionId === 'all' || selectedCollectionId === 'unclassified'
          ? await fetchMyBookmarks(
              nextCursor,
              BOOKMARK_PAGE_SIZE,
              requestOptions,
              selectedCollectionId as BookmarkScope,
            )
          : await fetchCollectionBookmarks(
              selectedCollectionId,
              nextCursor,
              BOOKMARK_PAGE_SIZE,
              requestOptions,
            );

      setBookmarks((current) => {
        const existingPostIds = new Set(current.map((post) => post.postId));
        const nextItems = page.items.filter((post) => !existingPostIds.has(post.postId));
        return [...current, ...nextItems];
      });
      setNextCursor(page.nextCursor);
      setHasNext(page.hasNext);

      if (selectedCollectionId !== 'all' && selectedCollectionId !== 'unclassified') {
        setCollectionCountOverrides((current) => ({
          ...current,
          [selectedCollectionId]: page.hasNext
            ? Math.max(current[selectedCollectionId] ?? 0, bookmarks.length + page.items.length)
            : bookmarks.length + page.items.length,
        }));
      }
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
    if (likeLoadingByPostId[post.postId]) {
      return;
    }

    const optimistic = updatePostLikeState(post);
    setLikeLoadingByPostId((current) => ({ ...current, [post.postId]: true }));

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
    } finally {
      setLikeLoadingByPostId((current) => {
        const next = { ...current };
        delete next[post.postId];
        return next;
      });
    }
  };

  const handlePostDeleted = (postId: string) => {
    removeBookmark(postId);
  };

  const handleOpenPost = (postId: string, target: PostDetailTarget = 'post') => {
    const search = target === 'comments' ? '?target=comments' : '';
    router.push(`/posts/${encodeURIComponent(postId)}${search}`);
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white shadow-lg dark:bg-neutral-900 dark:text-[#f5b93d]">
            <Bookmark size={24} className="fill-current" />
          </div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-black dark:text-zinc-100">북마크</h1>
          <p className="mt-3 text-xs font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            불러온 북마크 {bookmarks.length}개
          </p>
        </div>

        <div className="w-full space-y-3 md:w-96">
          <div className="relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
              size={18}
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="게시물, 작성자, 게임 검색"
              className="w-full rounded-[20px] border-none bg-zinc-100 py-4 pl-12 pr-4 text-sm font-black text-black shadow-inner outline-none transition-all placeholder:text-zinc-400 focus:ring-2 focus:ring-black dark:!bg-neutral-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:shadow-none dark:focus:ring-[#f5b93d]"
            />
          </div>

          <button
            type="button"
            onClick={() => setMediaOnly((current) => !current)}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-black transition ${
              mediaOnly
                ? 'bg-black text-white dark:bg-[#f5b93d] dark:text-black'
                : 'bg-zinc-100 text-zinc-500 hover:text-black dark:bg-neutral-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            <ImageIcon size={14} />
            미디어만 보기
          </button>

        </div>
      </div>

      <section className="mb-10" aria-label="북마크 모음집">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-black dark:text-zinc-100">모음집</h2>
            <p className="mt-1 text-xs font-bold text-zinc-400">
              저장한 게시물을 모음집별로 확인하세요.
            </p>
          </div>
          <span className="text-xs font-black text-zinc-400">
            {collectionsLoading ? '불러오는 중' : `${collections.length}개`}
          </span>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => setSelectedCollectionId('all')}
            className={`flex min-h-24 w-40 shrink-0 flex-col justify-between rounded-lg border p-4 text-left transition ${
              selectedCollectionId === 'all'
                ? 'border-black bg-black text-white shadow-lg dark:border-[#f5b93d] dark:bg-[#f5b93d] dark:text-black'
                : 'border-zinc-200 bg-white text-black hover:border-zinc-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-zinc-100 dark:hover:border-neutral-600'
            }`}
          >
            <Bookmark size={20} className="fill-current" />
            <span>
              <strong className="block text-sm font-black">전체 북마크</strong>
              <small className="mt-1 block text-xs font-bold opacity-60">
                {bookmarks.length}개 게시물
              </small>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCollectionId('unclassified')}
            className={`flex min-h-24 w-40 shrink-0 flex-col justify-between rounded-lg border p-4 text-left transition ${
              selectedCollectionId === 'unclassified'
                ? 'border-black bg-black text-white shadow-lg dark:border-[#f5b93d] dark:bg-[#f5b93d] dark:text-black'
                : 'border-zinc-200 bg-white text-black hover:border-zinc-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-zinc-100 dark:hover:border-neutral-600'
            }`}
          >
            <Folder size={20} className={selectedCollectionId === 'unclassified' ? 'fill-current' : 'text-zinc-400'} />
            <span>
              <strong className="block text-sm font-black">미분류</strong>
              <small className="mt-1 block text-xs font-bold opacity-60">
                모음집 없는 북마크
              </small>
            </span>
          </button>

          {collections.map((collection) => {
            const isSelected = selectedCollectionId === collection.collectionId;
            const displayCount =
              collectionCountOverrides[collection.collectionId] ?? collection.bookmarkCount;

            return (
              <button
                key={collection.collectionId}
                type="button"
                onClick={() => setSelectedCollectionId(collection.collectionId)}
                className={`flex min-h-24 w-40 shrink-0 flex-col justify-between rounded-lg border p-4 text-left transition ${
                  isSelected
                    ? 'border-black bg-black text-white shadow-lg dark:border-[#f5b93d] dark:bg-[#f5b93d] dark:text-black'
                    : 'border-zinc-200 bg-white text-black hover:border-zinc-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-zinc-100 dark:hover:border-neutral-600'
                }`}
              >
                <Folder size={20} className={isSelected ? 'fill-current' : 'text-zinc-400'} />
                  <span className="min-w-0">
                    <strong className="block truncate text-sm font-black">
                    {collection.name}
                  </strong>
                  <small className="mt-1 block text-xs font-bold opacity-60">
                    {displayCount}개 게시물
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {selectedCollection ? (
        <div className="mb-5 flex items-center gap-2 text-sm font-black text-zinc-500 dark:text-zinc-400">
          <Folder size={16} />
          <span>{selectedCollection.name}</span>
        </div>
      ) : selectedCollectionId === 'unclassified' ? (
        <div className="mb-5 flex items-center gap-2 text-sm font-black text-zinc-500 dark:text-zinc-400">
          <Folder size={16} />
          <span>미분류 북마크</span>
        </div>
      ) : null}

      <section className="mb-10" aria-label="북마크 모음집">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-black dark:text-zinc-100">모음집</h2>
            <p className="mt-1 text-xs font-bold text-zinc-400">
              저장한 게시물을 모음집별로 확인하세요.
            </p>
          </div>
          <span className="text-xs font-black text-zinc-400">{collections.length}개</span>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => setSelectedCollectionId('all')}
            className={`flex min-h-24 w-40 shrink-0 flex-col justify-between rounded-lg border p-4 text-left transition ${
              selectedCollectionId === 'all'
                ? 'border-black bg-black text-white shadow-lg dark:border-[#f5b93d] dark:bg-[#f5b93d] dark:text-black'
                : 'border-zinc-200 bg-white text-black hover:border-zinc-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-zinc-100 dark:hover:border-neutral-600'
            }`}
          >
            <Bookmark size={20} className="fill-current" />
            <span>
              <strong className="block text-sm font-black">전체 북마크</strong>
              <small className="mt-1 block text-xs font-bold opacity-60">
                {bookmarks.length}개 게시물
              </small>
            </span>
          </button>

          {collections.map((collection) => {
            const isSelected = selectedCollectionId === collection.id;
            const savedCount = collection.savedPostIds.filter((postId) =>
              bookmarks.some((post) => post.postId === postId),
            ).length;

            return (
              <button
                key={collection.id}
                type="button"
                onClick={() => setSelectedCollectionId(collection.id)}
                className={`flex min-h-24 w-40 shrink-0 flex-col justify-between rounded-lg border p-4 text-left transition ${
                  isSelected
                    ? 'border-black bg-black text-white shadow-lg dark:border-[#f5b93d] dark:bg-[#f5b93d] dark:text-black'
                    : 'border-zinc-200 bg-white text-black hover:border-zinc-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-zinc-100 dark:hover:border-neutral-600'
                }`}
              >
                <Folder size={20} className={isSelected ? 'fill-current' : 'text-zinc-400'} />
                <span className="min-w-0">
                  <strong className="block truncate text-sm font-black">
                    {collection.title}
                  </strong>
                  <small className="mt-1 block text-xs font-bold opacity-60">
                    {savedCount}개 게시물
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {selectedCollection ? (
        <div className="mb-5 flex items-center gap-2 text-sm font-black text-zinc-500 dark:text-zinc-400">
          <Folder size={16} />
          <span>{selectedCollection.title}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[32px] border border-zinc-100 bg-white p-10 text-center font-black text-zinc-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-zinc-500">
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
        <div className="rounded-[36px] border border-dashed border-zinc-200 bg-zinc-50 px-6 py-16 text-center dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-zinc-300 shadow-sm dark:bg-black dark:text-zinc-500 dark:shadow-none">
            <Bookmark size={30} />
          </div>
          <h2 className="text-2xl font-black italic tracking-tight text-black dark:text-zinc-100">
            {selectedCollection || selectedCollectionId === 'unclassified' || query.trim() || mediaOnly
              ? '표시할 북마크가 없어요'
              : '아직 저장한 게시물이 없어요'}
          </h2>
          <p className="mt-3 text-sm font-bold text-zinc-400 dark:text-zinc-500">
            {selectedCollection || selectedCollectionId === 'unclassified'
              ? '선택한 모음집 조건에 맞는 게시물이 없습니다.'
              : query.trim() || mediaOnly
                ? '검색어나 필터 조건을 바꿔보세요.'
                : '피드에서 북마크 아이콘을 누르면 이곳에 저장됩니다.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookmarks.map((post, index) => (
              <motion.div
                key={post.postId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                {post.media.length > 0 ? (
                  <div className="mb-2 flex flex-wrap items-center gap-2 px-2 text-[11px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                    <span className="flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-1 text-zinc-500 dark:bg-neutral-900 dark:text-zinc-400">
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
                  <div className="mb-2 px-2 text-[11px] font-black text-zinc-400 dark:text-zinc-500">
                    <HighlightedText text={`${post.author} @${post.authorHandle}`} query={query} />
                  </div>
                ) : null}
                <Post
                  post={post}
                  likeLoading={Boolean(likeLoadingByPostId[post.postId])}
                  onToggleLike={handleToggleLike}
                  onOpenDetail={(selected) => handleOpenPost(selected.postId)}
                  onOpenComments={(selected) => handleOpenPost(selected.postId, 'comments')}
                  onShare={handlePostUpdated}
                  onRepostChange={handlePostUpdated}
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
              className="w-full rounded-2xl border border-zinc-100 bg-white px-6 py-4 text-sm font-black text-zinc-600 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:text-zinc-300 dark:border-neutral-800 dark:bg-neutral-900 dark:text-zinc-400 dark:hover:border-[#f5b93d] dark:hover:text-zinc-100 dark:disabled:text-zinc-700"
            >
              {loadingMore ? '불러오는 중...' : '더 보기'}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
