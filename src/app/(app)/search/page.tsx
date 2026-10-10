'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Hash, Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Post } from '@/app/home/components/Post';
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
} from '@/lib/feed-api';
import {
  updatePostsBookmarkState,
  updatePostsLikeState,
  updatePostsRepostState,
} from '@/lib/post-mutations';
import { useCursorList } from '@/hooks/useCursorList';
import { usePostLike } from '@/hooks/usePostLike';

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

function EmptyState({ query, label }: { query: string; label: string }) {
  return (
    <div className="rounded-[32px] border border-dashed border-zinc-200 bg-zinc-50 px-6 py-16 text-center dark:border-neutral-800 dark:bg-neutral-900">
      <Search className="mx-auto text-zinc-300 dark:text-zinc-600" size={30} />
      <h2 className="mt-4 text-xl font-black text-zinc-900 dark:text-zinc-100">
        {query ? `${label} 결과가 없습니다.` : '검색어를 입력해 주세요.'}
      </h2>
      <p className="mt-2 text-sm font-bold text-zinc-400">
        {query ? '다른 키워드로 다시 검색해 보세요.' : '위 검색창에서 사용자, 게시글, 해시태그를 검색할 수 있습니다.'}
      </p>
    </div>
  );
}

function AccountCard({ account }: { account: SimpleUserProfile }) {
  return (
    <Link
      href={`/profile/${encodeURIComponent(account.handle)}`}
      className="flex items-center gap-4 rounded-2xl border border-zinc-100 bg-white p-4 transition hover:border-zinc-300 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black text-sm font-black text-white">
        {account.profileImageUrl ? (
          <Image
            src={account.profileImageUrl}
            alt={account.nickname}
            fill
            unoptimized
            sizes="48px"
            className="object-cover"
          />
        ) : (
          getInitials(account.nickname)
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-black dark:text-zinc-100">{account.nickname}</p>
        <p className="truncate text-xs font-bold text-zinc-400">@{account.handle}</p>
        {account.bio ? (
          <p className="mt-1 line-clamp-1 text-xs font-medium text-zinc-500">{account.bio}</p>
        ) : null}
      </div>
    </Link>
  );
}

function HashtagCard({ hashtag }: { hashtag: HashtagSummary }) {
  return (
    <Link
      href={`/hashtags/${encodeURIComponent(hashtag.name)}`}
      className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-100 bg-white p-4 transition hover:border-emerald-300 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
          <Hash size={20} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-black dark:text-zinc-100">#{hashtag.name}</p>
          <p className="text-xs font-bold text-zinc-400">게시물 {hashtag.postCount.toLocaleString()}개</p>
        </div>
      </div>
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
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="text-lg font-black text-black dark:text-zinc-100">{title}</h2>
      {hasMore && onMore ? (
        <button
          type="button"
          onClick={onMore}
          className="text-xs font-black text-zinc-400 transition hover:text-black dark:hover:text-zinc-100"
        >
          더보기
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
    <div className="space-y-4">
      {items.map((post) => (
        <Post
          key={post.postId}
          post={post}
          likeLoading={Boolean(likeLoadingByPostId[post.postId])}
          onToggleLike={toggleLike}
          onOpenDetail={(selected) => router.push(`/posts/${encodeURIComponent(selected.postId)}`)}
          onOpenComments={(selected) => router.push(`/posts/${encodeURIComponent(selected.postId)}?target=comments`)}
          onShare={handlePostUpdated}
          onRepostChange={handleRepostChanged}
          onBookmarkChange={handleBookmarkChanged}
          onDelete={(deletedPost) => handlePostDeleted(deletedPost.postId)}
        />
      ))}
    </div>
  );

  return (
    <div className="border-t-4 border-[#f5b93d]">
      <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-8">
        <header className="pb-7">
          <h1 className="text-2xl font-black text-black dark:text-zinc-100">검색 결과</h1>
          <p className="mt-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {query ? `'${query}'에 대한 결과` : '검색어를 입력해 주세요'}
          </p>
          <form
            role="search"
            onSubmit={handleSearchSubmit}
            className="mt-5 flex h-12 w-full items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 shadow-sm focus-within:border-[#f5b93d] dark:border-neutral-700 dark:bg-neutral-900"
          >
            <Search
              size={19}
              className="shrink-0 text-zinc-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="사용자, 게시글, 해시태그 검색"
              aria-label="검색 페이지 검색"
              maxLength={100}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-black px-4 py-2 text-sm font-black text-white transition hover:bg-zinc-800 dark:bg-[#f5b93d] dark:text-black dark:hover:bg-[#dca62f]"
            >
              검색
            </button>
          </form>
        </header>

        <nav
          className="grid grid-cols-4 border-b border-zinc-200 dark:border-neutral-800"
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
                className={`relative flex min-h-12 items-center justify-center px-2 text-sm font-black transition ${
                  isSelected
                    ? 'text-black dark:text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200'
                }`}
              >
                <span>{tab.label}</span>
                {isSelected ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#f5b93d]" /> : null}
              </button>
            );
          })}
        </nav>

        <section className="mt-8 min-h-72" aria-live="polite">
          {loading ? (
            <div className="rounded-[32px] border border-zinc-100 bg-white p-10 text-center font-black text-zinc-400 dark:border-neutral-800 dark:bg-neutral-900">
              검색 결과를 불러오는 중...
            </div>
          ) : error ? (
            <div className="rounded-[32px] border border-red-100 bg-red-50 p-10 text-center">
              <p className="font-black text-red-500">{error}</p>
              <button
                type="button"
                onClick={() => void reload()}
                className="mt-5 rounded-2xl bg-black px-5 py-3 text-sm font-black text-white transition hover:bg-zinc-800"
              >
                다시 시도
              </button>
            </div>
          ) : !query ? (
            <EmptyState query={query} label={activeTabLabel} />
          ) : activeTab === 'all' ? (
            overview ? (
              <div className="space-y-10">
                <section>
                  <SectionHeader
                    title="사용자"
                    hasMore={overview.accounts.hasMore}
                    onMore={() => setTab('accounts')}
                  />
                  {overview.accounts.items.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {overview.accounts.items.map((account) => (
                        <AccountCard key={account.userId} account={account} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState query={query} label="사용자" />
                  )}
                </section>

                <section>
                  <SectionHeader
                    title="해시태그"
                    hasMore={overview.hashtags.hasMore}
                    onMore={() => setTab('hashtags')}
                  />
                  {overview.hashtags.items.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {overview.hashtags.items.map((hashtag) => (
                        <HashtagCard key={hashtag.hashtagId} hashtag={hashtag} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState query={query} label="해시태그" />
                  )}
                </section>

                <section>
                  <SectionHeader
                    title="게시글"
                    hasMore={overview.posts.hasMore}
                    onMore={() => setTab('posts')}
                  />
                  {overview.posts.items.length > 0 ? renderPosts(overview.posts.items) : <EmptyState query={query} label="게시글" />}
                </section>
              </div>
            ) : (
              <EmptyState query={query} label="전체" />
            )
          ) : activeTab === 'accounts' ? (
            accounts.length > 0 ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  {accounts.map((account) => (
                    <AccountCard key={account.userId} account={account} />
                  ))}
                </div>
                {accountHasNext ? (
                  <button
                    type="button"
                    onClick={() => void loadMoreAccounts()}
                    disabled={loadingMore}
                    className="mt-6 w-full rounded-2xl border border-zinc-100 bg-white px-6 py-4 text-sm font-black text-zinc-600 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:text-zinc-300"
                  >
                    {loadingMore ? '불러오는 중...' : '더보기'}
                  </button>
                ) : null}
              </>
            ) : (
              <EmptyState query={query} label="사용자" />
            )
          ) : activeTab === 'posts' ? (
            posts.length > 0 ? (
              <>
                {renderPosts(posts)}
                {postHasNext ? (
                  <button
                    type="button"
                    onClick={() => void loadMorePosts()}
                    disabled={loadingMore}
                    className="mt-6 w-full rounded-2xl border border-zinc-100 bg-white px-6 py-4 text-sm font-black text-zinc-600 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:text-zinc-300"
                  >
                    {loadingMore ? '불러오는 중...' : '더보기'}
                  </button>
                ) : null}
              </>
            ) : (
              <EmptyState query={query} label="게시글" />
            )
          ) : hashtags.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {hashtags.map((hashtag) => (
                <HashtagCard key={hashtag.hashtagId} hashtag={hashtag} />
              ))}
            </div>
          ) : (
            <EmptyState query={query} label="해시태그" />
          )}
        </section>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-8 py-16 text-center text-sm font-bold text-zinc-400">
          검색 화면을 불러오는 중입니다.
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
