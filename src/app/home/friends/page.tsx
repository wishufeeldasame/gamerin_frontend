'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bookmark, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/app/context/AuthContext';
import { PostRecord } from '@/lib/feed-api';
import {
  BOOKMARKS_CHANGED_EVENT,
  getBookmarkedPosts,
  saveBookmarkedPost,
} from '@/lib/bookmark-store';
import { Post } from '../components/Post';
import { PostDetail } from '../components/PostDetail';

export default function BookmarksPage() {
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<PostRecord[]>([]);
  const [query, setQuery] = useState('');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
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

  const filteredBookmarks = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return bookmarks;
    }

    return bookmarks.filter((post) =>
      [
        post.author,
        post.authorHandle,
        post.game ?? '',
        post.content ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    );
  }, [bookmarks, query]);

  const handlePostUpdated = (updatedPost: PostRecord) => {
    setBookmarks((current) =>
      current.map((post) => (post.postId === updatedPost.postId ? updatedPost : post))
    );
    saveBookmarkedPost(updatedPost, bookmarkUserKey);
  };

  if (selectedPostId) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <PostDetail
          postId={selectedPostId}
          onBack={() => setSelectedPostId(null)}
          onPostUpdated={handlePostUpdated}
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
        </div>

        <div className="relative w-full md:w-80">
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
      </div>

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
      ) : filteredBookmarks.length === 0 ? (
        <div className="rounded-[32px] border border-zinc-100 bg-white p-10 text-center font-black text-zinc-400">
          검색 결과가 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookmarks.map((post, index) => (
            <motion.div
              key={post.postId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <Post
                post={post}
                onOpenDetail={(selected) => setSelectedPostId(selected.postId)}
                onShare={handlePostUpdated}
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
