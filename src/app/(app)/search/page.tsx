'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Post } from '@/app/home/components/Post';
import { PostListSkeleton, UserRowsSkeleton } from '@/app/home/components/LoadingSkeletons';
import {
  fetchSearchAccounts,
  fetchSearchHashtags,
  fetchSearchOverview,
  fetchSearchPosts,
  type HashtagSummary,
  type SearchOverview,
  type SimpleUserProfile,
} from '@/lib/community-search-api';
import {
  type PostRecord,
  getInitials,
  getPostHref,
} from '@/lib/feed-api';
import {
  updatePostsBookmarkState,
  updatePostsLikeState,
  updatePostsRepostState,
} from '@/lib/post-mutations';
import { useCursorList } from '@/hooks/useCursorList';
import { usePostLike } from '@/hooks/usePostLike';
import { MembershipBadge } from '@/app/home/components/MembershipBadge';
import { RepresentativeTierBadge } from '@/app/home/components/RepresentativeTierBadge';
import { RightSidebar } from '@/app/home/components/RightSidebar';

const searchTabs = [
  { value: 'all', label: '전체' },
  { value: 'accounts', label: '사용자' },
  { value: 'posts', label: '게시글' },
  { value: 'hashtags', label: '해시태그' },
] as const;

type SearchTab = (typeof searchTabs)[number]['value'];

const OVERVIEW_SIZE = 5;
const PAGE_SIZE = 20;

function isSearchTab(value: string | null): value is SearchTab {
  return searchTabs.some((tab) => tab.value === value);
}

function normalizeQuery(value: string) {
  return value.trim().slice(0, 100);
}

// 라이트에서 흰 카드 위 yellow/500 포커스는 대비가 3:1에 못 미쳐 text/brand를 쓴다(PR #180과 같은 규칙).
const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg-brand dark:focus-visible:outline-line-focus';

function EmptyState({ query, label, compact = false }: { query: string; label: string; compact?: boolean }) {
  // 전체 탭의 섹션별 빈 결과는 한 줄로 줄여 다른 섹션 결과가 밀리지 않게 한다.
  if (compact) {
    return <p className="rounded-card border border-line-card bg-surface px-4 py-3 text-body text-fg-secondary">{label} 결과가 없습니다.</p>;
  }

  return (
    <div className="flex flex-col items-center rounded-card border border-line-card bg-surface px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-icon-secondary">
        <Search size={20} strokeWidth={1.67} aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-body font-bold text-fg-primary">
        {query ? (label === '전체' ? '검색 결과가 없습니다.' : `${label} 결과가 없습니다.`) : '검색어를 입력해 주세요.'}
      </h2>
      <p className="mt-1 text-body text-fg-secondary">
        {query ? '다른 키워드로 다시 검색해 보세요.' : '위 검색창에서 사용자, 게시글, 해시태그를 검색할 수 있습니다.'}
      </p>
    </div>
  );
}

function AccountRow({ account }: { account: SimpleUserProfile }) {
  return (
    <Link
      href={`/profile/${encodeURIComponent(account.handle)}`}
      className={`-mx-2 flex items-center gap-3 rounded-control px-2 py-2.5 transition hover:bg-subtle ${FOCUS_RING}`}
    >
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-subtle text-label text-fg-secondary">
        {account.profileImageUrl ? (
          <Image
            src={account.profileImageUrl}
            alt={account.nickname}
            fill
            unoptimized
            sizes="40px"
            className="object-cover"
          />
        ) : (
          getInitials(account.nickname)
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5 text-body font-medium text-fg-primary">
          <span className="truncate">{account.nickname}</span>
          <MembershipBadge active={account.membershipBadge} /><RepresentativeTierBadge tier={account.representativeTier} />
        </p>
        <p className="truncate text-caption text-fg-tertiary">@{account.handle}</p>
        {account.bio ? (
          <p className="mt-0.5 line-clamp-1 text-label font-normal text-fg-secondary">{account.bio}</p>
        ) : null}
      </div>
    </Link>
  );
}

function HashtagChip({ hashtag }: { hashtag: HashtagSummary }) {
  return (
    <Link
      href={`/hashtags/${encodeURIComponent(hashtag.name)}`}
      className={`inline-flex h-9 max-w-full items-center rounded-full bg-subtle px-3 text-label text-fg-primary transition hover:bg-line ${FOCUS_RING}`}
    >
      <span className="truncate">#{hashtag.name}</span>
      <span className="ml-1 shrink-0 text-fg-tertiary">· {hashtag.postCount.toLocaleString()}</span>
    </Link>
  );
}

function SectionHeader({
  title,
  hasMore,
  onMore,
}: {
  title: string;
  hasMore?: boolean;
  onMore?: () => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-4">
      <h2 className="text-heading text-fg-primary">{title}</h2>
      {hasMore && onMore ? (
        <button
          type="button"
          onClick={onMore}
          className={`rounded-sm text-label text-fg-secondary transition hover:text-fg-primary ${FOCUS_RING}`}
        >
          모두 보기
        </button>
      ) : null}
    </div>
  );
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = normalizeQuery(searchParams.get('q') ?? '');
  const tabParam = searchParams.get('tab');
  const activeTab = isSearchTab(tabParam) ? tabParam : 'all';
  const [overview, setOverview] = useState<SearchOverview | null>(null);
  const [searchInput, setSearchInput] = useState(query);
  const [hashtags, setHashtags] = useState<HashtagSummary[]>([]);
  const [specialLoading, setSpecialLoading] = useState(false);
  const [specialError, setSpecialError] = useState<string | null>(null);
  const loadControllerRef = useRef<AbortController | null>(null);

  const loadAccountPage = useCallback(
    (cursor: string | null, { signal }: { signal: AbortSignal }) =>
      fetchSearchAccounts(query, cursor, PAGE_SIZE, { signal }),
    [query],
  );
  const loadPostPage = useCallback(
    (cursor: string | null, { signal }: { signal: AbortSignal }) =>
      fetchSearchPosts(query, cursor, PAGE_SIZE, { signal }),
    [query],
  );
  const accountList = useCursorList({
    loadPage: loadAccountPage,
    getKey: (account: SimpleUserProfile) => account.userId,
    queryKey: `${query}:accounts:${activeTab}`,
    enabled: Boolean(query) && activeTab === 'accounts',
    initialErrorMessage: '검색 결과를 불러오지 못했습니다.',
    loadMoreErrorMessage: '결과를 더 불러오지 못했습니다.',
  });
  const postList = useCursorList({
    loadPage: loadPostPage,
    getKey: (post: PostRecord) => post.postId,
    queryKey: `${query}:posts:${activeTab}`,
    enabled: Boolean(query) && activeTab === 'posts',
    initialErrorMessage: '검색 결과를 불러오지 못했습니다.',
    loadMoreErrorMessage: '결과를 더 불러오지 못했습니다.',
  });
  const {
    items: accounts,
    hasNext: accountHasNext,
    loading: accountsLoading,
    loadingMore: accountsLoadingMore,
    error: accountsError,
    reload: reloadAccounts,
    loadMore: loadMoreAccounts,
  } = accountList;
  const {
    items: posts,
    setItems: setPosts,
    hasNext: postHasNext,
    loading: postsLoading,
    loadingMore: postsLoadingMore,
    error: postsError,
    reload: reloadPosts,
    loadMore: loadMorePosts,
  } = postList;

  const activeTabLabel = useMemo(
    () => searchTabs.find((tab) => tab.value === activeTab)?.label ?? '전체',
    [activeTab],
  );

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const params = new URLSearchParams(searchParams.toString());
    const nextQuery = normalizeQuery(searchInput);
    if (nextQuery) {
      params.set('q', nextQuery);
    } else {
      params.delete('q');
    }

    const nextSearch = params.toString();
    router.push(`/search${nextSearch ? `?${nextSearch}` : ''}`);
  };

  const setTab = (tab: SearchTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    if (query) {
      params.set('q', query);
    }
    router.push(`/search?${params.toString()}`);
  };

  const loadSearch = useCallback(async () => {
    loadControllerRef.current?.abort();
    loadControllerRef.current = null;

    setOverview(null);
    setHashtags([]);

    if (!query || (activeTab !== 'all' && activeTab !== 'hashtags')) {
      setSpecialError(null);
      setSpecialLoading(false);
      return;
    }

    const controller = new AbortController();
    loadControllerRef.current = controller;

    try {
      setSpecialLoading(true);
      setSpecialError(null);

      if (activeTab === 'all') {
        setOverview(await fetchSearchOverview(query, OVERVIEW_SIZE, { signal: controller.signal }));
      } else {
        setHashtags(await fetchSearchHashtags(query, PAGE_SIZE, { signal: controller.signal }));
      }
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') {
        return;
      }

      setSpecialError(loadError instanceof Error ? loadError.message : '검색 결과를 불러오지 못했습니다.');
    } finally {
      if (loadControllerRef.current === controller) {
        loadControllerRef.current = null;
        setSpecialLoading(false);
      }
    }
  }, [activeTab, query]);

  useEffect(() => {
    void loadSearch();
    return () => {
      loadControllerRef.current?.abort();
    };
  }, [loadSearch]);


  const handlePostUpdated = (updatedPost: PostRecord) => {
    setPosts((current) =>
      current.map((post) => (post.postId === updatedPost.postId ? updatedPost : post)),
    );
    setOverview((current) =>
      current
        ? {
            ...current,
            posts: {
              ...current.posts,
              items: current.posts.items.map((post) =>
                post.postId === updatedPost.postId ? updatedPost : post,
              ),
            },
          }
        : current,
    );
  };

  const updateLikeState = useCallback((postId: string, likedByMe: boolean) => {
    setPosts((current) => updatePostsLikeState(current, postId, likedByMe));
    setOverview((current) =>
      current
        ? {
            ...current,
            posts: {
              ...current.posts,
              items: updatePostsLikeState(current.posts.items, postId, likedByMe),
            },
          }
        : current,
    );
  }, [setPosts]);

  const { toggleLike, likeLoadingByPostId } = usePostLike(updateLikeState);

  const handlePostDeleted = (postId: string) => {
    setPosts((current) => current.filter((post) => post.postId !== postId));
    setOverview((current) =>
      current
        ? {
            ...current,
            posts: {
              ...current.posts,
              items: current.posts.items.filter((post) => post.postId !== postId),
            },
          }
        : current,
    );
  };

  const handleRepostChanged = (updatedPost: PostRecord) => {
    const updateRepost = (posts: PostRecord[]) =>
      updatePostsRepostState(
        posts,
        updatedPost.postId,
        updatedPost.isReposted,
        updatedPost.repostCount,
      );

    setPosts(updateRepost);
    setOverview((current) =>
      current
        ? {
            ...current,
            posts: {
              ...current.posts,
              items: updateRepost(current.posts.items),
            },
          }
        : current,
    );
  };

  const handleBookmarkChanged = (updatedPost: PostRecord, bookmarked = updatedPost.bookmarkedByMe) => {
    setPosts((current) => updatePostsBookmarkState(current, updatedPost.postId, bookmarked));
    setOverview((current) =>
      current
        ? {
            ...current,
            posts: {
              ...current.posts,
              items: updatePostsBookmarkState(
                current.posts.items,
                updatedPost.postId,
                bookmarked,
              ),
            },
          }
        : current,
    );
  };

  const loading = activeTab === 'accounts'
    ? accountsLoading
    : activeTab === 'posts'
      ? postsLoading
      : specialLoading;
  const loadingMore = activeTab === 'accounts' ? accountsLoadingMore : postsLoadingMore;
  const error = activeTab === 'accounts'
    ? accountsError
    : activeTab === 'posts'
      ? postsError
      : specialError;
  const reload = activeTab === 'accounts'
    ? reloadAccounts
    : activeTab === 'posts'
      ? reloadPosts
      : loadSearch;

  const renderPosts = (items: PostRecord[]) => (
    <div className="space-y-3">
      {items.map((post) => (
        <Post
          key={post.postId}
          post={post}
          likeLoading={Boolean(likeLoadingByPostId[post.postId])}
          onToggleLike={toggleLike}
          onOpenDetail={(selected) => router.push(getPostHref(selected.postNumber))}
          onOpenComments={(selected) => router.push(getPostHref(selected.postNumber, '?target=comments'))}
          onShare={handlePostUpdated}
          onRepostChange={handleRepostChanged}
          onBookmarkChange={handleBookmarkChanged}
          onDelete={(deletedPost) => handlePostDeleted(deletedPost.postId)}
        />
      ))}
    </div>
  );

  const loadMoreButton = (onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      disabled={loadingMore}
      className="btn-secondary mt-3 w-full"
    >
      {loadingMore ? '불러오는 중...' : '더보기'}
    </button>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-8 md:px-8">
      <div className="min-w-0 flex-1 px-4 py-4 md:px-0 lg:py-6">
        <header className="pb-4">
          <h1 className="page-title">검색 결과</h1>
          {/* 시안대로 버튼 없이 Enter로 제출한다. 모바일 키보드는 type=search라 검색 키가 나온다. */}
          <form
            role="search"
            onSubmit={handleSearchSubmit}
            className="mt-4 flex h-11 w-full items-center gap-2.5 rounded-control border border-transparent bg-subtle px-3.5 focus-within:border-line-focus"
          >
            <Search
              size={20}
              strokeWidth={1.67}
              className="shrink-0 text-icon-secondary"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="사용자, 게시글, 해시태그 검색"
              aria-label="검색 페이지 검색"
              maxLength={100}
              enterKeyHint="search"
              className="min-w-0 flex-1 bg-transparent text-body text-fg-primary outline-none placeholder:text-fg-tertiary"
            />
          </form>
        </header>

        <nav
          className="flex gap-7 border-b border-line"
          aria-label="검색 결과 유형"
        >
          {searchTabs.map((tab) => {
            const isSelected = activeTab === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setTab(tab.value)}
                aria-pressed={isSelected}
                className={`relative shrink-0 py-3 text-body transition-colors ${FOCUS_RING} ${
                  isSelected ? 'font-bold text-fg-primary' : 'text-fg-tertiary hover:text-fg-secondary'
                }`}
              >
                {tab.label}
                {isSelected ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-brand" /> : null}
              </button>
            );
          })}
        </nav>

        <section className="mt-6 min-h-72" aria-live="polite">
          {loading ? (
            activeTab === 'accounts' ? <UserRowsSkeleton /> : <PostListSkeleton count={3} label="검색 결과를 불러오는 중" />
          ) : error ? (
            <div role="alert" className="flex flex-col items-center rounded-card border border-line-card bg-surface px-6 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-icon-secondary">
                <Search size={20} strokeWidth={1.67} aria-hidden="true" />
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
          ) : !query ? (
            <EmptyState query={query} label={activeTabLabel} />
          ) : activeTab === 'all' ? (
            overview ? (
              <div className="space-y-8">
                <section>
                  <SectionHeader
                    title="사용자"
                    hasMore={overview.accounts.hasMore}
                    onMore={() => setTab('accounts')}
                  />
                  {overview.accounts.items.length > 0 ? (
                    <div>
                      {overview.accounts.items.map((account) => (
                        <AccountRow key={account.userId} account={account} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState compact query={query} label="사용자" />
                  )}
                </section>

                <section>
                  <SectionHeader
                    title="해시태그"
                    hasMore={overview.hashtags.hasMore}
                    onMore={() => setTab('hashtags')}
                  />
                  {overview.hashtags.items.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {overview.hashtags.items.map((hashtag) => (
                        <HashtagChip key={hashtag.hashtagId} hashtag={hashtag} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState compact query={query} label="해시태그" />
                  )}
                </section>

                <section>
                  <SectionHeader
                    title="게시글"
                    hasMore={overview.posts.hasMore}
                    onMore={() => setTab('posts')}
                  />
                  {overview.posts.items.length > 0 ? renderPosts(overview.posts.items) : <EmptyState compact query={query} label="게시글" />}
                </section>
              </div>
            ) : (
              <EmptyState query={query} label="전체" />
            )
          ) : activeTab === 'accounts' ? (
            accounts.length > 0 ? (
              <>
                <div>
                  {accounts.map((account) => (
                    <AccountRow key={account.userId} account={account} />
                  ))}
                </div>
                {accountHasNext ? loadMoreButton(() => void loadMoreAccounts()) : null}
              </>
            ) : (
              <EmptyState query={query} label="사용자" />
            )
          ) : activeTab === 'posts' ? (
            posts.length > 0 ? (
              <>
                {renderPosts(posts)}
                {postHasNext ? loadMoreButton(() => void loadMorePosts()) : null}
              </>
            ) : (
              <EmptyState query={query} label="게시글" />
            )
          ) : hashtags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {hashtags.map((hashtag) => (
                <HashtagChip key={hashtag.hashtagId} hashtag={hashtag} />
              ))}
            </div>
          ) : (
            <EmptyState query={query} label="해시태그" />
          )}
        </section>
      </div>

      <aside className="sticky top-[var(--app-header-height)] hidden h-[calc(100vh-var(--app-header-height))] w-80 shrink-0 py-6 xl:block">
        <RightSidebar />
      </aside>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-16 text-center text-body text-fg-tertiary">
          검색 화면을 불러오는 중입니다.
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
