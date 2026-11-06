'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, ImageIcon, Plus, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  fetchCollectionBookmarks,
  fetchMyBookmarks,
} from '@/lib/feed-api';
import { type BookmarkScope, type PostRecord, getPostHref } from '@/lib/feed-api';
import { Post } from '@/app/home/components/Post';
import { PostListSkeleton } from '@/app/home/components/LoadingSkeletons';
import { useBookmarkCollections } from '@/app/context/BookmarkCollectionContext';
import { useCursorList } from '@/hooks/useCursorList';
import { usePostLike } from '@/hooks/usePostLike';
import {
  updatePostsBookmarkState,
  updatePostsLikeState,
  updatePostsRepostState,
} from '@/lib/post-mutations';

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
          <mark key={`${part}-${index}`} className="rounded-sm bg-brand-subtle px-0.5 text-fg-brand">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      )}
    </>
  );
}

// 라이트에서 흰 바탕 위 yellow/500 포커스는 대비가 부족해 text/brand를 쓴다(PR #180과 같은 규칙).
const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg-brand dark:focus-visible:outline-line-focus';

// 시안의 `+ 새 모음집`. 이름 규칙(최대 40자, 빈 이름 불가)은 SaveToCollectionModal과 같다.
function NewCollectionButton() {
  const { createCollection } = useBookmarkCollections();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    setIsOpen(false);
    setName('');
    setError('');
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-label text-fg-brand transition hover:bg-subtle xl:h-11 xl:rounded-control ${FOCUS_RING}`}
      >
        <Plus size={16} strokeWidth={1.67} aria-hidden="true" />
        새 모음집
      </button>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('모음집 이름을 입력해 주세요.');
      return;
    }

    setPending(true);
    setError('');
    try {
      await createCollection(trimmedName);
      close();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '모음집을 만들 수 없습니다.');
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      onBlur={(event) => {
        // 아무것도 적지 않고 폼 밖으로 포커스가 나가면 닫는다(모바일에는 Esc가 없다). 입력→만들기 Tab 이동은 폼 안이라 닫지 않는다.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        if (!name.trim() && !pending) close();
      }}
      className="w-64 shrink-0 xl:mt-2 xl:w-auto"
    >
      <div className="flex gap-1.5">
        <input
          autoFocus
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
          }}
          disabled={pending}
          maxLength={40}
          placeholder="모음집 이름"
          aria-label="새 모음집 이름"
          className="input-base h-9 min-w-0 xl:h-10"
        />
        <button
          type="submit"
          disabled={pending}
          // Safari는 클릭한 버튼에 포커스를 주지 않아 relatedTarget이 비고 폼이 닫힌다. 클릭 동안 입력 포커스를 유지한다.
          onMouseDown={(event) => event.preventDefault()}
          className="btn-primary h-9 xl:h-10"
        >
          {pending ? '저장 중...' : '만들기'}
        </button>
      </div>
      {error ? <p role="alert" className="mt-1 text-caption text-fg-danger">{error}</p> : null}
    </form>
  );
}

export default function BookmarksPage() {
  const router = useRouter();
  const { collections, loading: collectionsLoading } = useBookmarkCollections();
  const [query, setQuery] = useState('');
  const [mediaOnly, setMediaOnly] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('all');
  const [collectionCountSyncPending, setCollectionCountSyncPending] = useState(false);
  const collectionCountSyncBaseRef = useRef(collections);
  // 모음집 변경 응답이 늦게 와도 전환 후 목록을 건드리지 않도록 최신 선택값을 본다.
  const selectedCollectionIdRef = useRef(selectedCollectionId);
  useEffect(() => {
    selectedCollectionIdRef.current = selectedCollectionId;
  }, [selectedCollectionId]);

  const loadPage = useCallback((cursor: string | null, { signal }: { signal: AbortSignal }) => {
    const requestOptions = {
      signal,
      q: query,
      mediaOnly,
    };

    return selectedCollectionId === 'all' || selectedCollectionId === 'unclassified'
      ? fetchMyBookmarks(
          cursor,
          BOOKMARK_PAGE_SIZE,
          requestOptions,
          selectedCollectionId as BookmarkScope,
        )
      : fetchCollectionBookmarks(
          selectedCollectionId,
          cursor,
          BOOKMARK_PAGE_SIZE,
          requestOptions,
        );
  }, [mediaOnly, query, selectedCollectionId]);

  const bookmarkQueryKey = useMemo(
    () => JSON.stringify([selectedCollectionId, query, mediaOnly]),
    [mediaOnly, query, selectedCollectionId],
  );
  const {
    items: bookmarks,
    setItems: setBookmarks,
    nextCursor,
    hasNext,
    loading,
    loadingMore,
    error,
    reload,
    loadMore: handleLoadMore,
  } = useCursorList<PostRecord>({
    loadPage,
    getKey: (post) => post.postId,
    queryKey: bookmarkQueryKey,
    initialErrorMessage: '북마크를 불러오지 못했습니다.',
    loadMoreErrorMessage: '북마크를 더 불러오지 못했습니다.',
  });

  const applyLikeState = useCallback((postId: string, likedByMe: boolean) => {
    setBookmarks((current) => updatePostsLikeState(current, postId, likedByMe));
  }, [setBookmarks]);
  const { toggleLike: handleToggleLike, likeLoadingByPostId } = usePostLike(applyLikeState);

  const upsertBookmark = useCallback((post: PostRecord) => {
    setBookmarks((current) => {
      const exists = current.some((item) => item.postId === post.postId);
      if (!exists) {
        return [post, ...current];
      }

      return current.map((item) => (item.postId === post.postId ? post : item));
    });
  }, [setBookmarks]);

  const removeBookmark = useCallback((postId: string) => {
    setBookmarks((current) => current.filter((post) => post.postId !== postId));
  }, [setBookmarks]);

  const handleBookmarkChanged = useCallback((changedPost: PostRecord, bookmarked = changedPost.bookmarkedByMe) => {
    if (!bookmarked) {
      return;
    }

    setBookmarks((current) => {
      const exists = current.some((post) => post.postId === changedPost.postId);
      return exists
        ? updatePostsBookmarkState(current, changedPost.postId, true)
        : [changedPost, ...current];
    });
  }, [setBookmarks]);

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.collectionId === selectedCollectionId),
    [collections, selectedCollectionId],
  );

  useEffect(() => {
    if (
      !collectionCountSyncPending ||
      collections === collectionCountSyncBaseRef.current
    ) {
      return;
    }

    setCollectionCountSyncPending(false);
  }, [collectionCountSyncPending, collections]);

  const handlePostUpdated = (updatedPost: PostRecord) => {
    if (updatedPost.bookmarkedByMe) {
      upsertBookmark(updatedPost);
      return;
    }

    removeBookmark(updatedPost.postId);
  };

  const handleRepostChanged = (updatedPost: PostRecord) => {
    setBookmarks((current) =>
      updatePostsRepostState(
        current,
        updatedPost.postId,
        updatedPost.isReposted,
        updatedPost.repostCount,
      ),
    );
  };

  const handlePostDeleted = (postId: string) => {
    removeBookmark(postId);
  };

  const handleOpenPost = (postNumber: number, target: PostDetailTarget = 'post') => {
    const search = target === 'comments' ? '?target=comments' : '';
    router.push(getPostHref(postNumber, search));
  };

  const selectedLabel = selectedCollection?.name
    ?? (selectedCollectionId === 'unclassified' ? '미분류' : '전체 북마크');
  const collectionItems = [
    { id: 'all', name: '전체 북마크', count: null },
    { id: 'unclassified', name: '미분류', count: null },
    ...collections.map((collection) => ({
      id: collection.collectionId,
      name: collection.name,
      count: collectionCountSyncPending ? '동기화 중' : String(collection.bookmarkCount),
    })),
  ];

  return (
    // 불러오는 동안 화면보다 짧아지면 스크롤바가 사라졌다 다시 생겨 깜빡인다.
    // 모음집 목록은 한 벌만 렌더링하고, 모바일은 제목 아래 가로 칩, xl 이상은 오른쪽 열 목록(F8)으로 배치만 바꾼다.
    <div className={`mx-auto grid w-full max-w-6xl grid-cols-1 md:px-8 xl:grid-cols-[minmax(0,1fr)_20rem] xl:grid-rows-[auto_1fr] xl:gap-x-8 ${loading ? 'min-h-[100dvh]' : ''}`}>
      <header className="min-w-0 px-4 pt-4 md:px-0 lg:pt-6 xl:col-start-1">
        <h1 className="page-title">북마크</h1>
        <p className="mt-1 text-caption text-fg-tertiary">
          {selectedLabel}
          {/* 전체·미분류는 총개수 API가 없어 다 불러왔을 때만 센다. 모음집은 서버 개수를 쓴다. */}
          {!loading && !error && !hasNext ? ` · ${bookmarks.length}개` : ''}
        </p>

        <div className="mt-4 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-icon-secondary"
              size={18}
              strokeWidth={1.67}
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="게시글, 작성자, 게임 검색"
              aria-label="북마크 검색"
              className="input-base pl-10"
            />
          </div>

          <button
            type="button"
            onClick={() => setMediaOnly((current) => !current)}
            aria-pressed={mediaOnly}
            className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-control px-3 text-label transition ${FOCUS_RING} ${
              mediaOnly
                ? 'bg-brand-subtle text-fg-brand'
                : 'bg-subtle text-fg-secondary hover:text-fg-primary'
            }`}
          >
            <ImageIcon size={16} strokeWidth={1.67} aria-hidden="true" />
            미디어만
          </button>
        </div>
      </header>

      <aside
        aria-label="북마크 모음집"
        className="min-w-0 py-3 xl:sticky xl:top-[var(--app-header-height)] xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:self-start xl:py-6"
      >
        <h2 className="mb-3 hidden items-baseline gap-1.5 text-heading text-fg-primary xl:flex">
          모음집
          <span className="text-label font-normal text-fg-tertiary">
            {collectionsLoading ? '불러오는 중' : collections.length}
          </span>
        </h2>

        <div className="flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:px-0 xl:flex-col xl:gap-0.5 xl:overflow-visible">
          {collectionItems.map((item) => {
            const isSelected = selectedCollectionId === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedCollectionId(item.id)}
                aria-pressed={isSelected}
                className={`flex h-9 max-w-56 shrink-0 items-center gap-1.5 rounded-full border px-3 text-label transition xl:h-11 xl:max-w-none xl:justify-between xl:rounded-control xl:border-transparent xl:px-3 xl:text-body ${FOCUS_RING} ${
                  isSelected
                    ? 'border-brand bg-brand-subtle text-fg-brand xl:bg-subtle xl:font-medium xl:text-fg-primary'
                    : 'border-transparent bg-subtle text-fg-secondary hover:text-fg-primary xl:bg-transparent xl:hover:bg-subtle'
                }`}
              >
                <span className="truncate">{item.name}</span>
                {item.count !== null ? (
                  <span className={`shrink-0 text-caption ${isSelected ? '' : 'text-fg-tertiary'}`}>{item.count}</span>
                ) : null}
              </button>
            );
          })}
          <NewCollectionButton />
        </div>
      </aside>

      <section className="min-w-0 px-4 pb-4 md:px-0 xl:col-start-1 xl:pt-3" aria-label={`${selectedLabel} 게시물`}>
      {loading ? (
        <PostListSkeleton count={3} label="북마크를 불러오는 중" />
      ) : error ? (
        <div role="alert" className="flex flex-col items-center rounded-card border border-line-card bg-surface px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-icon-secondary">
            <Bookmark size={20} strokeWidth={1.67} aria-hidden="true" />
          </span>
          <p className="mt-4 text-body font-bold text-fg-primary">{error}</p>
          <p className="mt-1 text-body text-fg-secondary">네트워크 상태를 확인한 뒤 다시 시도해 주세요.</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="btn-secondary mt-6"
          >
            다시 시도
          </button>
        </div>
      ) : bookmarks.length === 0 ? (
        <div className="flex flex-col items-center rounded-card border border-line-card bg-surface px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-icon-secondary">
            <Bookmark size={20} strokeWidth={1.67} aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-body font-bold text-fg-primary">
            {selectedCollection || selectedCollectionId === 'unclassified' || query.trim() || mediaOnly
              ? '표시할 북마크가 없습니다'
              : '아직 저장한 게시글이 없습니다'}
          </h2>
          <p className="mt-1 text-body text-fg-secondary">
            {selectedCollection || selectedCollectionId === 'unclassified'
              ? '선택한 모음집 조건에 맞는 게시글이 없습니다.'
              : query.trim() || mediaOnly
                ? '검색어나 필터 조건을 바꿔보세요.'
                : '피드에서 북마크 아이콘을 누르면 이곳에 저장됩니다.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookmarks.map((post, index) => (
              <motion.div
                key={post.postId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                {query.trim() ? (
                  <p className="mb-1.5 px-1 text-caption text-fg-tertiary">
                    <HighlightedText text={`${post.author} @${post.authorHandle}`} query={query} />
                  </p>
                ) : null}
                <Post
                  post={post}
                  likeLoading={Boolean(likeLoadingByPostId[post.postId])}
                  onToggleLike={handleToggleLike}
                  onOpenDetail={(selected) => handleOpenPost(selected.postNumber)}
                  onOpenComments={(selected) => handleOpenPost(selected.postNumber, 'comments')}
                  onShare={handlePostUpdated}
                  onRepostChange={handleRepostChanged}
                  onDelete={(deletedPost) => handlePostDeleted(deletedPost.postId)}
                  onBookmarkChange={handleBookmarkChanged}
                  onCollectionChange={(changedPost, collectionId, containsPost) => {
                    // 현재 보고 있는 모음집·미분류 조건에서 벗어난 게시물만 목록에서 뺀다.
                    const currentCollectionId = selectedCollectionIdRef.current;
                    if (
                      (!containsPost && collectionId === currentCollectionId) ||
                      (containsPost && currentCollectionId === 'unclassified')
                    ) {
                      removeBookmark(changedPost.postId);
                    }
                  }}
                  onBookmarkSuccess={(changedPost, bookmarked) => {
                    if (!bookmarked) {
                      collectionCountSyncBaseRef.current = collections;
                      setCollectionCountSyncPending(true);
                      removeBookmark(changedPost.postId);
                    }
                  }}
                />
              </motion.div>
            ))}

          {hasNext && nextCursor ? (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="btn-secondary w-full"
            >
              {loadingMore ? '불러오는 중...' : '더 보기'}
            </button>
          ) : null}
        </div>
      )}
      </section>
    </div>
  );
}
