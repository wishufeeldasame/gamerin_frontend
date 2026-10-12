'use client';

import { useToast } from '@/app/context/ToastContext';
import { restoreFeedbackFocus, useConfirm } from '@/app/context/ConfirmContext';

import Image from 'next/image';
import Link from 'next/link';
import { Bookmark, Flag, Heart, MessageCircle, MoreHorizontal, Repeat2, Share2 } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/app/context/AuthContext';
import {
  PostMedia,
  PostRecord,
  bookmarkPost,
  deletePost,
  getInitials,
  unbookmarkPost,
  updatePostBookmarkState,
} from '@/lib/feed-api';
import { SharePostModal } from './SharePostModal';
import SaveToCollectionModal from './SaveToCollectionModal';
import { ReportContentModal } from './Report';
import { useRepost } from '@/hooks/useRepost';
import { HashtagText } from './HashtagText';
import { RelativeTime } from './RelativeTime';
import { usePopup } from '@/app/context/PopupContext';
import { useDismissable } from '@/hooks/useDismissable';
import { PostImage } from './PostImage';

interface PostProps {
  post: PostRecord;
  likeLoading?: boolean;
  onToggleLike?: (post: PostRecord) => void;
  onOpenDetail?: (post: PostRecord) => void;
  onOpenComments?: (post: PostRecord) => void;
  onShare?: (post: PostRecord) => void;
  onBookmarkChange?: (post: PostRecord, bookmarked: boolean) => void;
  onBookmarkSuccess?: (post: PostRecord, bookmarked: boolean) => void;
  onRepostChange?: (post: PostRecord) => void;
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
        <div className="pointer-events-none relative z-10 px-5 pb-4">
          <div className="pointer-events-auto overflow-hidden rounded-[24px] border border-zinc-50 shadow-inner" data-card-open-ignore="true">
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
      <div className="pointer-events-none relative z-10 px-5 pb-4">
        <div className="relative overflow-hidden rounded-[24px] border border-zinc-50 shadow-inner">
          <PostImage
            src={item.mediaUrl}
            imageNumber={1}
            width={1200}
            height={800}
            sizes="(max-width: 768px) 100vw, 700px"
            className="h-auto max-h-[420px] w-full object-cover transition-transform duration-700 hover:scale-105"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none relative z-10 grid grid-cols-2 gap-2 px-5 pb-4">
      {media.slice(0, 4).map((item, index) => (
        <div key={item.mediaId} className="relative overflow-hidden rounded-[20px] border border-zinc-50">
          {item.mediaType === 'VIDEO' ? (
            <div className="pointer-events-auto" data-card-open-ignore="true">
              <video
                controls
                poster={item.thumbnailUrl ?? undefined}
                className="h-52 w-full bg-black object-cover"
                src={item.mediaUrl}
              />
            </div>
          ) : (
            <PostImage
              src={item.mediaUrl}
              imageNumber={index + 1}
              width={800}
              height={800}
              className="h-52 w-full object-cover"
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function Post({
  post,
  likeLoading = false,
  onToggleLike,
  onOpenDetail,
  onOpenComments,
  onShare,
  onBookmarkChange,
  onBookmarkSuccess,
  onRepostChange,
  onDelete,
}: PostProps) {
  const toast = useToast();
  const confirm = useConfirm(post.postId);
  const deleteLockRef = useRef(false);
  const latestPostRef = useRef(post);
  const shareLifetime = useMemo(() => ({ active: false, postId: post.postId }), [post.postId]);
  useLayoutEffect(() => {
    latestPostRef.current = post;
  }, [post]);
  useLayoutEffect(() => {
    shareLifetime.active = true;
    return () => { shareLifetime.active = false; };
  }, [shareLifetime]);
  const { user } = useAuth();
  const initials = getInitials(post.author);
  const hasMedia = post.media.length > 0;
  const [shareOpen, setShareOpen] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const menuId = useId();
  const { isOpen: menuOpen, toggle: toggleMenu, close: closeMenu, closeAll } = usePopup(menuId);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  useDismissable({ open: menuOpen, onDismiss: closeMenu, triggerRef: menuTriggerRef, panelRef: menuPanelRef });
  const [reportOpen, setReportOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bookmarked, setBookmarked] = useState(post.bookmarkedByMe);
  const [bookmarking, setBookmarking] = useState(false);
  const {
    isReposted,
    repostCount,
    isLoading: isRepostLoading,
    error: repostError,
    toggleRepost,
  } = useRepost(post, onRepostChange);
  const canDeletePost = post.mine || Boolean(user?.handle && user.handle === post.authorHandle);
  const canReportPost = !canDeletePost;
  const canRepostPost = !post.mine;
  const repostButtonTitle = post.mine
    ? '본인 게시글은 리포스트할 수 없습니다.'
    : repostError ?? undefined;

  useEffect(() => {
    setBookmarked(post.bookmarkedByMe);
  }, [post.bookmarkedByMe]);

  const handleBodyClick = (event: MouseEvent<HTMLParagraphElement>) => {
    // The sibling overlay is the keyboard path; text stays above it for selection.
    if (event.target instanceof Element && event.target.closest('a, [data-card-open-ignore="true"]')) return;
    if (window.getSelection()?.isCollapsed === false) return;
    onOpenDetail?.(post);
  };

  const handleOpenComments = () => {
    if (onOpenComments) {
      onOpenComments(post);
      return;
    }

    onOpenDetail?.(post);
  };

  const handleBookmarkStateChange = async (
    nextBookmarked: boolean,
    options: { skipRequest?: boolean } = {},
  ) => {
    if (bookmarking) {
      return false;
    }

    if (nextBookmarked === bookmarked) {
      return true;
    }

    const nextPost = updatePostBookmarkState(post, nextBookmarked);
    setBookmarked(nextBookmarked);
    onBookmarkChange?.(nextPost, nextBookmarked);

    if (options.skipRequest) {
      onBookmarkSuccess?.(nextPost, nextBookmarked);
      return true;
    }

    setBookmarking(true);

    try {
      try {
        if (nextBookmarked) {
          await bookmarkPost(post.postId);
        } else {
          await unbookmarkPost(post.postId);
        }
      } catch (error) {
        setBookmarked(bookmarked);
        onBookmarkChange?.(post, bookmarked);
        toast.error(error instanceof Error ? error.message : '북마크 상태를 변경하지 못했습니다.');
        return false;
      }

      onBookmarkSuccess?.(nextPost, nextBookmarked);

      return true;
    } finally {
      setBookmarking(false);
    }
  };

  const handleDelete = async () => {
    if (deleteLockRef.current || deleting) {
      return;
    }

    deleteLockRef.current = true;
    closeMenu();
    try {
      const confirmed = await confirm({
        message: '게시물을 삭제할까요?', confirmLabel: '삭제', danger: true,
        returnFocusTo: menuTriggerRef.current,
      });
      if (!confirmed) return;
      setDeleting(true);
      await deletePost(post.postId);
      closeMenu();
      onDelete?.(post);
      window.requestAnimationFrame(() => {
        if (!menuTriggerRef.current?.isConnected && document.activeElement === document.body) {
          restoreFeedbackFocus(null);
        }
      });
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : '게시물을 삭제하지 못했습니다.');
    } finally {
      deleteLockRef.current = false;
      setDeleting(false);
    }
  };

  return (
    <>
      <motion.article
        whileHover={{ y: -4 }}
        className={`relative isolate overflow-hidden rounded-[32px] border border-zinc-100 bg-white shadow-sm transition-all duration-300 hover:shadow-xl ${
          onOpenDetail ? 'cursor-pointer' : ''
        }`}
      >
        {onOpenDetail ? (
          <button
            type="button"
            onClick={() => onOpenDetail(post)}
            aria-label={`${post.author}님의 게시물 열기`}
            className="absolute inset-0 z-0 rounded-[32px] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black dark:focus-visible:ring-white"
          />
        ) : null}
        {post.reposterInfo ? (
          <div className="pointer-events-none relative z-10 flex items-center gap-2 border-b border-zinc-100 px-5 py-3 text-xs font-bold text-zinc-500 dark:border-neutral-800 dark:text-zinc-400">
            <Repeat2 size={15} className="text-emerald-500" />
            <span>
              {post.reposterInfo.nickname}님이 리포스트했습니다
              {' · '}
              <RelativeTime createdAt={post.reposterInfo.repostedAt} />
            </span>
          </div>
        ) : null}

        <div className="pointer-events-none relative z-20 p-5">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href={`/profile/${encodeURIComponent(post.authorHandle)}`}
            className="pointer-events-auto flex items-center gap-4"
            data-card-open-ignore="true"
          >
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
                @{post.authorHandle} · <RelativeTime createdAt={post.createdAt} />
              </span>
            </div>
          </Link>

          <div className="pointer-events-auto relative">
            <button
              type="button"
              ref={menuTriggerRef}
              onClick={toggleMenu}
              className="rounded-xl p-2 text-zinc-300 transition-all hover:bg-zinc-50 hover:text-black"
              aria-label="게시물 메뉴"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? menuId : undefined}
            >
              <MoreHorizontal size={20} />
            </button>

            {menuOpen ? (
              <div ref={menuPanelRef} id={menuId} className="absolute right-0 top-10 z-30 min-w-36 overflow-hidden rounded-2xl border border-zinc-100 bg-white py-1 shadow-xl">
                {canReportPost ? (
                  <button
                    type="button"
                    onClick={() => {
                      closeMenu();
                      setReportOpen(true);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-black text-red-500 transition hover:bg-red-50"
                  >
                    <Flag size={15} />
                    게시물 신고
                  </button>
                ) : null}

                {canDeletePost ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="w-full px-4 py-3 text-left text-sm font-black text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
                  >
                    {deleting ? '삭제 중...' : '삭제'}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={closeMenu}
                  className="w-full px-4 py-3 text-left text-sm font-black text-zinc-500 transition hover:bg-zinc-50"
                >
                  취소
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {post.content ? (
          <p onClick={handleBodyClick} className="pointer-events-auto w-full cursor-text select-text px-1 text-left text-[15px] font-medium leading-7 text-zinc-800">
            <HashtagText text={post.content} />
          </p>
        ) : null}
        </div>

        {hasMedia ? <MediaBlock key={post.postId} media={post.media} /> : null}

        <div className="pointer-events-none relative z-10 flex items-center justify-between border-t border-zinc-50 bg-white px-6 py-4 text-zinc-400 [&_button]:pointer-events-auto [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-4 [&_button]:focus-visible:outline-black dark:[&_button]:focus-visible:outline-white">
          <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => onToggleLike?.(post)}
            aria-label={`좋아요 ${post.likes}개`}
            aria-pressed={post.likedByMe}
            disabled={likeLoading}
            className={`group flex items-center gap-2 transition-colors ${
              post.likedByMe ? 'text-red-500' : 'hover:text-red-500'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <Heart size={20} className={post.likedByMe ? 'fill-red-500' : 'transition-all group-hover:fill-red-500'} />
            <span className="text-sm font-black text-zinc-800">{post.likes}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenComments}
            className="flex items-center gap-2 transition-colors hover:text-black"
            aria-label="댓글 보기"
          >
            <MessageCircle size={20} />
            <span className="text-sm font-black text-zinc-800">{post.comments}</span>
          </button>

          <button
            type="button"
            onClick={() => void toggleRepost()}
            disabled={isRepostLoading || !canRepostPost}
            aria-label="리포스트"
            aria-pressed={isReposted}
            aria-describedby={repostButtonTitle ? `${menuId}-repost-reason` : undefined}
            title={repostButtonTitle}
            className={`group flex items-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              isReposted ? 'text-emerald-500' : 'hover:text-emerald-500'
            }`}
          >
            <Repeat2 size={20} />
            <span
              className={`text-sm font-black ${
                isReposted ? 'text-emerald-500' : 'text-zinc-800'
              }`}
            >
              {repostCount}
            </span>
          </button>

          {repostButtonTitle ? <span id={`${menuId}-repost-reason`} className="sr-only">{repostButtonTitle}</span> : null}
          <button
            type="button"
            onClick={() => { closeAll(); setCollectionModalOpen(true); }}
            aria-haspopup="dialog"
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
            onClick={() => { closeAll(); setShareOpen(true); }}
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
          onShared={(sharedPost) => {
            const currentPost = latestPostRef.current;
            if (!shareLifetime.active || currentPost.postId !== sharedPost.postId) return;
            const updatedPost = { ...currentPost, shares: sharedPost.shares };
            latestPostRef.current = updatedPost;
            onShare?.(updatedPost);
          }}
        />
      ) : null}

      <SaveToCollectionModal
        isOpen={collectionModalOpen}
        postId={post.postId}
        isBookmarked={bookmarked}
        onClose={() => setCollectionModalOpen(false)}
        onBookmarkStateChange={handleBookmarkStateChange}
      />

      {reportOpen ? (
        <ReportContentModal
          targetType="POST"
          targetId={post.postId}
          title="게시물 신고"
          author={post.author}
          authorHandle={post.authorHandle}
          content={post.content}
          emptyContentLabel="미디어 게시글"
          onClose={() => setReportOpen(false)}
        />
      ) : null}
    </>
  );
}
