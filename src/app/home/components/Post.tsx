'use client';

import Image from 'next/image';
import { Bookmark, Heart, MessageCircle, Share2, MoreHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/app/context/AuthContext';
import {
  PostMedia,
  PostRecord,
  bookmarkPost,
  deletePost,
  formatRelativeTime,
  getInitials,
  unbookmarkPost,
  updatePostBookmarkState,
} from '@/lib/feed-api';
import { SharePostModal } from './SharePostModal';

interface PostProps {
  post: PostRecord;
  onToggleLike?: (post: PostRecord) => void;
  onOpenDetail?: (post: PostRecord) => void;
  onShare?: (post: PostRecord) => void;
  onBookmarkChange?: (post: PostRecord, bookmarked: boolean) => void;
  onDelete?: (post: PostRecord) => void;
}

function MediaBlock({ media }: { media: PostMedia[] }) {
  if (media.length === 0) {
    return null;
  }

  if (media.length === 1) {
    const item = media[0];
    if (item.mediaType === 'VIDEO') {
      return (
        <div className="px-5 pb-4">
          <div className="overflow-hidden rounded-[24px] border border-zinc-50 shadow-inner">
            <video
              controls
              poster={item.thumbnailUrl ?? undefined}
              className="max-h-[420px] w-full bg-black object-cover"
              src={item.mediaUrl}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="px-5 pb-4">
        <div className="relative overflow-hidden rounded-[24px] border border-zinc-50 shadow-inner">
          <Image
            src={item.mediaUrl}
            alt="Post media"
            width={1200}
            height={800}
            unoptimized
            sizes="(max-width: 768px) 100vw, 700px"
            className="h-auto max-h-[420px] w-full object-cover transition-transform duration-700 hover:scale-105"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 px-5 pb-4">
      {media.slice(0, 4).map((item) => (
        <div key={item.mediaId} className="relative overflow-hidden rounded-[20px] border border-zinc-50">
          {item.mediaType === 'VIDEO' ? (
            <video
              controls
              poster={item.thumbnailUrl ?? undefined}
              className="h-52 w-full bg-black object-cover"
              src={item.mediaUrl}
            />
          ) : (
            <Image
              src={item.mediaUrl}
              alt="Post media"
              width={800}
              height={800}
              unoptimized
              className="h-52 w-full object-cover"
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function Post({ post, onToggleLike, onOpenDetail, onShare, onBookmarkChange, onDelete }: PostProps) {
  const { user } = useAuth();
  const initials = getInitials(post.author);
  const hasMedia = post.media.length > 0;
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bookmarked, setBookmarked] = useState(post.bookmarkedByMe);
  const [bookmarking, setBookmarking] = useState(false);
  const canDeletePost = post.mine || Boolean(user?.handle && user.handle === post.authorHandle);

  useEffect(() => {
    setBookmarked(post.bookmarkedByMe);
  }, [post.bookmarkedByMe]);

  const handleToggleBookmark = async () => {
    if (bookmarking) {
      return;
    }

    const nextBookmarked = !bookmarked;
    const nextPost = updatePostBookmarkState(post, nextBookmarked);
    setBookmarked(nextBookmarked);
    onBookmarkChange?.(nextPost, nextBookmarked);

    try {
      setBookmarking(true);
      if (nextBookmarked) {
        await bookmarkPost(post.postId);
      } else {
        await unbookmarkPost(post.postId);
      }
    } catch (error) {
      setBookmarked(bookmarked);
      onBookmarkChange?.(post, bookmarked);
      alert(error instanceof Error ? error.message : 'Failed to update bookmark.');
    } finally {
      setBookmarking(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) {
      return;
    }

    const confirmed = window.confirm('게시물을 삭제할까요?');
    if (!confirmed) {
      setMenuOpen(false);
      return;
    }

    try {
      setDeleting(true);
      await deletePost(post.postId);
      setMenuOpen(false);
      onDelete?.(post);
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : '게시물 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <motion.article
        whileHover={{ y: -4 }}
        className="overflow-hidden rounded-[32px] border border-zinc-100 bg-white shadow-sm transition-all duration-300 hover:shadow-xl"
      >
        <div className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {post.authorProfileImageUrl ? (
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl shadow-inner">
                <Image src={post.authorProfileImageUrl} alt={post.author} fill unoptimized className="object-cover" />
              </div>
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black text-sm font-black text-white shadow-inner">
                {initials}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2">
                <h2 className="text-[16px] font-black tracking-tight text-black">{post.author}</h2>
              </div>
              <span className="text-[11px] font-bold text-zinc-400">
                @{post.authorHandle} · {formatRelativeTime(post.createdAt)}
              </span>
            </div>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (canDeletePost) {
                  setMenuOpen((current) => !current);
                }
              }}
              className="rounded-xl p-2 text-zinc-300 transition-all hover:bg-zinc-50 hover:text-black"
              aria-label="게시물 메뉴"
              aria-expanded={menuOpen}
              aria-disabled={!canDeletePost}
            >
              <MoreHorizontal size={20} />
            </button>

            {menuOpen && canDeletePost ? (
              <div className="absolute right-0 top-10 z-30 min-w-28 overflow-hidden rounded-2xl border border-zinc-100 bg-white py-1 shadow-xl">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full px-4 py-3 text-left text-sm font-black text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
                >
                  {deleting ? '삭제 중...' : '삭제'}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {post.content ? (
          <button
            type="button"
            onClick={() => onOpenDetail?.(post)}
            className="w-full px-1 text-left text-[15px] font-medium leading-7 text-zinc-800"
          >
            {post.content}
          </button>
        ) : null}
        </div>

        {hasMedia ? <MediaBlock media={post.media} /> : null}

        <div className="flex items-center justify-between border-t border-zinc-50 bg-white px-6 py-4 text-zinc-400">
          <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => onToggleLike?.(post)}
            className={`group flex items-center gap-2 transition-colors ${
              post.likedByMe ? 'text-red-500' : 'hover:text-red-500'
            }`}
          >
            <Heart size={20} className={post.likedByMe ? 'fill-red-500' : 'transition-all group-hover:fill-red-500'} />
            <span className="text-sm font-black text-zinc-800">{post.likes}</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenDetail?.(post)}
            className="flex items-center gap-2 transition-colors hover:text-black"
          >
            <MessageCircle size={20} />
            <span className="text-sm font-black text-zinc-800">{post.comments}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleBookmark}
            disabled={bookmarking}
            className={`group flex items-center gap-2 transition-colors ${
              bookmarked ? 'text-black' : 'hover:text-black'
            }`}
            aria-label={bookmarked ? '북마크 해제' : '북마크 저장'}
          >
            <Bookmark size={20} className={bookmarked ? 'fill-black' : 'transition-all group-hover:fill-black'} />
          </button>
          </div>

          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="rounded-xl p-2 text-zinc-400 transition-all hover:bg-zinc-50 hover:text-black"
            aria-label="게시물 공유"
          >
            <Share2 size={20} />
          </button>
        </div>
      </motion.article>

      {shareOpen ? (
        <SharePostModal
          post={post}
          onClose={() => setShareOpen(false)}
          onShared={(sharedPost) => onShare?.(sharedPost)}
        />
      ) : null}
    </>
  );
}
