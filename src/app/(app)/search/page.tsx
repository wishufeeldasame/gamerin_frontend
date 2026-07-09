'use client';

import { Suspense, useMemo, useState } from 'react';
import { Files, Hash, Search, Sparkles, UserRound } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import {
  GameFilter,
  gameFilterOptions,
  type GameFilterValue,
} from '@/app/home/components/GameFilter';

const searchTabs = [
  { value: 'popular', label: '인기', icon: Sparkles },
  { value: 'accounts', label: '계정', icon: UserRound },
  { value: 'posts', label: '게시글', icon: Files },
  { value: 'hashtag', label: '해시태그', icon: Hash },
] as const;

type SearchTab = (typeof searchTabs)[number]['value'];

function isSearchTab(value: string | null): value is SearchTab {
  return searchTabs.some((tab) => tab.value === value);
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<SearchTab>(
    isSearchTab(tabParam) ? tabParam : 'popular',
  );
  const [gameFilter, setGameFilter] = useState<GameFilterValue>('all');

  const activeTabLabel = useMemo(
    () => searchTabs.find((tab) => tab.value === activeTab)?.label ?? '인기',
    [activeTab],
  );
  const activeGameLabel = useMemo(
    () => gameFilterOptions.find((game) => game.value === gameFilter)?.label ?? '전체',
    [gameFilter],
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
      <header className="border-b border-zinc-200 pb-6 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-black text-white dark:bg-[#f5b93d] dark:text-black">
            <Search size={20} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black text-black dark:text-zinc-100">
              {query ? `“${query}” 검색 결과` : '탐색'}
            </h1>
            <p className="mt-1 text-xs font-bold text-zinc-400">
              {activeTabLabel} · {activeGameLabel}
            </p>
          </div>
        </div>
      </header>

      <nav
        className="mt-6 grid grid-cols-4 border-b border-zinc-200 dark:border-neutral-800"
        aria-label="검색 결과 유형"
      >
        {searchTabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.value;

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              aria-pressed={isSelected}
              className={`relative flex min-h-12 items-center justify-center gap-2 px-2 text-sm font-black transition ${
                isSelected
                  ? 'text-black dark:text-[#f5b93d]'
                  : 'text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200'
              }`}
            >
              <Icon size={17} />
              <span>{tab.label}</span>
              {isSelected ? (
                <span className="absolute inset-x-0 bottom-0 h-1 bg-black dark:bg-[#f5b93d]" />
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="mt-5">
        <GameFilter value={gameFilter} onChange={setGameFilter} />
      </div>

      <section
        key={`${activeTab}-${gameFilter}-${query}`}
        className="mt-8 min-h-72 border-t border-zinc-100 py-12 text-center dark:border-neutral-900"
        aria-live="polite"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-zinc-100 text-zinc-400 dark:bg-neutral-900 dark:text-zinc-500">
          {activeTab === 'accounts' ? (
            <UserRound size={22} />
          ) : activeTab === 'hashtag' ? (
            <Hash size={22} />
          ) : activeTab === 'posts' ? (
            <Files size={22} />
          ) : (
            <Sparkles size={22} />
          )}
        </div>
        <h2 className="mt-4 text-base font-black text-zinc-800 dark:text-zinc-200">
          {query ? `${activeTabLabel} 결과가 아직 없습니다.` : '검색어를 입력해 주세요.'}
        </h2>
        <p className="mt-2 text-sm font-medium text-zinc-400 dark:text-zinc-500">
          {query
            ? `${activeGameLabel} 카테고리에서 “${query}” 결과를 찾지 못했습니다.`
            : '상단 검색창에서 게임, 사용자, 게시글을 검색할 수 있습니다.'}
        </p>
      </section>
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
