'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bookmark, ImageIcon, Link2, Search, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/app/context/AuthContext';
import {
  BOOKMARKS_CHANGED_EVENT,
  BookmarkedPost,
  clearBookmarkedPosts,
  getBookmarkedPosts,
  saveBookmarkedPost,
} from '@/lib/bookmark-store';
import { PostRecord } from '@/lib/feed-api';
import { Post } from '../components/Post';
import { PostDetail } from '../components/PostDetail';

type BookmarkFilter = 'all' | 'media' | 'links';
type BookmarkSort = 'newest' | 'oldest';

const filterOptions: { value: BookmarkFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'media', label: '미디어' },
  { value: 'links', label: '링크' },
];

function formatSavedDate(value?: string) {
  if (!value) return '저장일 없음';

  return new Date(value).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<BookmarkedPost[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<BookmarkFilter>('all');
  const [sort, setSort] = useState<BookmarkSort>('newest');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const bookmarkUserKey = user?.id ?? user?.handle ?? null;

  useEffect(() => {
    const loadBookmarks = () => setBookmarks(getBookmarkedPosts(bookmarkUserKey));

    loadBookmarks();
    window.addEventListener(BOOKMARKS_CHANGED_EVENT, loadBookmarks);
    window.addEventListener('storage', loadBookmarks);

    return () => {
      window.removeEventListener(BOOKMARKS_CHANGED_EVENT, loadBookmarks);
      window.removeEventListener('storage', loadBookmarks);
    };
  }, [bookmarkUserKey]);

  const stats = useMemo(() => {
    return {
      total: bookmarks.length,
      media: bookmarks.filter((post) => post.media.length > 0).length,
      links: bookmarks.filter((post) => Boolean(post.externalLink)).length,
    };
  }, [bookmarks]);

  const visibleBookmarks = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return bookmarks
      .filter((post) => {
        if (filter === 'media') return post.media.length > 0;
        if (filter === 'links') return Boolean(post.externalLink);
        return true;
      })
      .filter((post) => {
        if (!keyword) return true;

        return [
        post.author,
        post.authorHandle,
        post.game ?? '',
        post.content ?? '',
        post.externalLink?.title ?? '',
        post.externalLink?.host ?? '',
      ]
        .join(' ')
        .toLowerCase()
          .includes(keyword);
      })
      .sort((left, right) => {
        const leftTime = new Date(left.bookmarkedAt ?? left.createdAt).getTime();
        const rightTime = new Date(right.bookmarkedAt ?? right.createdAt).getTime();
        return sort === 'newest' ? rightTime - leftTime : leftTime - rightTime;
      });
  }, [bookmarks, filter, query, sort]);

  const handlePostUpdated = (updatedPost: PostRecord) => {
    setBookmarks((current) =>
      current.map((post) => (post.postId === updatedPost.postId ? updatedPost : post))
    );
    saveBookmarkedPost(updatedPost, bookmarkUserKey);
  };

  const handlePostDeleted = (postId: string) => {
    setBookmarks((current) => current.filter((post) => post.postId !== postId));
    if (selectedPostId === postId) {
      setSelectedPostId(null);
    }
  };

  const handleClearBookmarks = () => {
    if (bookmarks.length === 0) return;

    const ok = window.confirm('저장한 북마크를 모두 삭제할까요?');
    if (!ok) return;

    clearBookmarkedPosts(bookmarkUserKey);
    setBookmarks([]);
    setStatusMessage('북마크를 모두 삭제했습니다.');
    window.setTimeout(() => setStatusMessage(''), 1800);
  };

  if (selectedPostId) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <PostDetail
          postId={selectedPostId}
          onBack={() => setSelectedPostId(null)}
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
          <p className="mt-2 text-sm font-bold text-zinc-400">저장한 게시물을 한곳에서 다시 확인하세요.</p>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center sm:max-w-md">
            <div className="rounded-2xl bg-zinc-50 px-4 py-3">
              <p className="text-xl font-black text-black">{stats.total}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">전체</p>
            </div>
            <div className="rounded-2xl bg-zinc-50 px-4 py-3">
              <p className="text-xl font-black text-black">{stats.media}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">미디어</p>
            </div>
            <div className="rounded-2xl bg-zinc-50 px-4 py-3">
              <p className="text-xl font-black text-black">{stats.links}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">링크</p>
            </div>
          </div>
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
            <button
              type="button"
              onClick={() => setSort((current) => (current === 'newest' ? 'oldest' : 'newest'))}
              className="rounded-2xl bg-zinc-100 px-4 py-2 text-xs font-black text-zinc-500 transition hover:text-black"
            >
              {sort === 'newest' ? '최신 저장순' : '오래된 저장순'}
            </button>
            <button
              type="button"
              onClick={handleClearBookmarks}
              disabled={bookmarks.length === 0}
              className="ml-auto flex items-center gap-1 rounded-2xl bg-red-50 px-4 py-2 text-xs font-black text-red-500 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:text-red-200"
            >
              <Trash2 size={14} />
              전체 삭제
            </button>
          </div>
        </div>
      </div>

      {statusMessage ? (
        <div className="mb-5 rounded-2xl bg-black px-5 py-3 text-sm font-black text-white">
          {statusMessage}
        </div>
      ) : null}

      {bookmarks.length === 0 ? (
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
              <div className="mb-2 flex flex-wrap items-center gap-2 px-2 text-[11px] font-black uppercase tracking-widest text-zinc-400">
                <span>저장됨 {formatSavedDate(post.bookmarkedAt)}</span>
                {post.media.length > 0 ? (
                  <span className="flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-1 text-zinc-500">
                    <ImageIcon size={12} />
                    Media
                  </span>
                ) : null}
                {post.externalLink ? (
                  <span className="flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-1 text-zinc-500">
                    <Link2 size={12} />
                    Link
                  </span>
                ) : null}
                {query.trim() ? (
                  <span className="normal-case">
                    <HighlightedText text={`${post.author} @${post.authorHandle}`} query={query} />
                  </span>
                ) : null}
              </div>
              <Post
                post={post}
                onOpenDetail={(selected) => setSelectedPostId(selected.postId)}
                onShare={handlePostUpdated}
                onDelete={(deletedPost) => handlePostDeleted(deletedPost.postId)}
                onBookmarkChange={(changedPost, bookmarked) => {
                  if (!bookmarked) {
                    setBookmarks((current) => current.filter((postItem) => postItem.postId !== changedPost.postId));
                  }
                }}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
