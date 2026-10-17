'use client';

import { useToast } from '@/app/context/ToastContext';
import { restoreFeedbackFocus, useConfirm } from '@/app/context/ConfirmContext';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Bookmark, Flag, Heart, MessageCircle, MoreHorizontal, Repeat2, Send } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePopup } from '@/app/context/PopupContext';
import { useDismissable } from '@/hooks/useDismissable';
import { motion } from 'framer-motion';
import { useAuth } from '@/app/context/AuthContext';
import {
  CommentRecord,
  PostRecord,
  bookmarkPost,
  createComment,
  deleteComment,
  deletePost,
  fetchPostDetail,
  fetchPostComments,
  getInitials,
  repostPost,
  unbookmarkPost,
  unrepostPost,
  updatePostBookmarkState,
  updatePostLikeState,
} from '@/lib/feed-api';
import { SharePostModal } from './SharePostModal';
import SaveToCollectionModal from './SaveToCollectionModal';
import { ReportContentModal } from './Report';
import { HashtagText } from './HashtagText';
import { RelativeTime } from './RelativeTime';
import { PostImage } from './PostImage';
import { usePostLike } from '@/hooks/usePostLike';
import { MembershipBadge } from './MembershipBadge';

const MAX_COMMENT_LENGTH = 300;

interface PostDetailProps {
  postId: string;
  onBack: () => void;
  initialScrollTarget?: 'comments';
  initialCommentId?: string;
  onPostUpdated?: (post: PostRecord) => void;
  onPostDeleted?: (postId: string) => void;
}

export function PostDetail({
  postId,
  onBack,
  initialScrollTarget,
  initialCommentId,
  onPostUpdated,
  onPostDeleted,
}: PostDetailProps) {
  const toast = useToast();
  const confirm = useConfirm(postId);
  const deleteCommentLockRef = useRef(false);
  const deletePostLockRef = useRef(false);
  const commentMenuButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const { user } = useAuth();
  const commentsSectionRef = useRef<HTMLDivElement | null>(null);
  const commentRefs = useRef(new Map<string, HTMLDivElement>());
  const handledScrollKeyRef = useRef<string | null>(null);
  const [post, setPost] = useState<PostRecord | null>(null);
  const latestPostRef = useRef<PostRecord | null>(post);
  useLayoutEffect(() => {
    latestPostRef.current = post;
  }, [post]);
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [commentMenuOpenId, setCommentMenuOpenId] = useState<string | null>(null);
  const [reportComment, setReportComment] = useState<CommentRecord | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);
  const submittingCommentRef = useRef(false);
  const commentRequestGenerationRef = useRef(0);
  const commentComposingRef = useRef(false);
  const commentCompositionEndedRef = useRef(false);
  const commentCompositionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearCommentCompositionGuard = () => {
    commentCompositionEndedRef.current = false;
    if (commentCompositionTimerRef.current !== null) {
      clearTimeout(commentCompositionTimerRef.current);
      commentCompositionTimerRef.current = null;
    }
  };
  useEffect(() => () => {
    if (commentCompositionTimerRef.current !== null) clearTimeout(commentCompositionTimerRef.current);
  }, []);
  const actionLifetime = useMemo(() => ({ active: false, postId }), [postId]);
  useLayoutEffect(() => {
    actionLifetime.active = true;
    deletePostLockRef.current = false;
    setDeletingPost(false);
    return () => { actionLifetime.active = false; };
  }, [actionLifetime]);
  const [shareOpen, setShareOpen] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const menuId = useId();
  const { isOpen: menuOpen, toggle: toggleMenu, close: closeMenu, closeAll } = usePopup(menuId);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  useDismissable({ open: menuOpen, onDismiss: closeMenu, triggerRef: menuTriggerRef, panelRef: menuPanelRef });
  const [reportPostOpen, setReportPostOpen] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [isRepostLoading, setIsRepostLoading] = useState(false);
  const [repostError, setRepostError] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const loadedPostId = post?.postId;
  const applyLikeState = useCallback((targetPostId: string, likedByMe: boolean) => {
    const currentPost = latestPostRef.current;
    if (!currentPost || currentPost.postId !== targetPostId) return;

    const nextPost = updatePostLikeState(currentPost, likedByMe);
    latestPostRef.current = nextPost;
    setPost(nextPost);
    onPostUpdated?.(nextPost);
  }, [onPostUpdated]);
  const { toggleLike, likeLoadingByPostId } = usePostLike(applyLikeState);
  const isLikeLoading = Boolean(post && likeLoadingByPostId[post.postId]);

  useEffect(() => {
    commentRequestGenerationRef.current += 1;
    submittingCommentRef.current = false;
    setSubmittingComment(false);

    return () => {
      commentRequestGenerationRef.current += 1;
      submittingCommentRef.current = false;
    };
  }, [postId]);

  useEffect(() => {
    const scrollKey = JSON.stringify([postId, initialCommentId ?? null, initialScrollTarget ?? null]);
    if (loading || loadedPostId !== postId) {
      return;
    }

    if (!initialCommentId && initialScrollTarget !== 'comments') {
      handledScrollKeyRef.current = null;
      return;
    }

    if (handledScrollKeyRef.current === scrollKey) {
      return;
    }

    const matchedComment = initialCommentId ? commentRefs.current.get(initialCommentId) : undefined;
    let highlightTimeout: number | undefined;
    const animationFrame = window.requestAnimationFrame(() => {
      handledScrollKeyRef.current = scrollKey;
      (matchedComment ?? commentsSectionRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

      if (matchedComment && initialCommentId) {
        setHighlightedCommentId(initialCommentId);
        highlightTimeout = window.setTimeout(() => setHighlightedCommentId(null), 2000);
      }
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      if (highlightTimeout !== undefined) {
        window.clearTimeout(highlightTimeout);
      }
    };
  }, [initialCommentId, initialScrollTarget, loadedPostId, loading, postId]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadPost = async () => {
      try {
        setLoading(true);
        setError(null);
        setComments([]);
        const [detail, commentList] = await Promise.all([
          fetchPostDetail(postId, { signal: controller.signal }),
          fetchPostComments(postId, { signal: controller.signal }),
        ]);
        if (!cancelled) {
          setPost(detail);
          setComments(commentList);
          latestPostRef.current = detail;
          setBookmarked(detail.bookmarkedByMe);
        }
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return;
        }

        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '게시물을 불러오지 못했습니다.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPost();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [postId]);

  const handleToggleLike = () => {
    const currentPost = latestPostRef.current;
    if (currentPost) void toggleLike(currentPost);
  };

  const handleToggleRepost = async () => {
    if (!post || isRepostLoading || post.mine) {
      return;
    }

    const currentPost = latestPostRef.current ?? post;
    const previousRepostState = {
      isReposted: currentPost.isReposted,
      repostCount: currentPost.repostCount,
    };
    const optimisticPost = {
      ...currentPost,
      isReposted: !currentPost.isReposted,
      repostCount: Math.max(
        0,
        currentPost.repostCount + (currentPost.isReposted ? -1 : 1),
      ),
    };

    setIsRepostLoading(true);
    setRepostError(null);
    latestPostRef.current = optimisticPost;
    setPost(optimisticPost);
    onPostUpdated?.(optimisticPost);

    try {
      const response = optimisticPost.isReposted
        ? await repostPost(currentPost.postId)
        : await unrepostPost(currentPost.postId);
      const latestPost = latestPostRef.current;
      if (!latestPost) {
        return;
      }
      const confirmedPost = {
        ...latestPost,
        isReposted: response.isReposted,
        repostCount: response.repostCount,
      };

      latestPostRef.current = confirmedPost;
      setPost(confirmedPost);
      onPostUpdated?.(confirmedPost);
    } catch (toggleError) {
      const latestPost = latestPostRef.current;
      if (latestPost) {
        const rollbackPost = { ...latestPost, ...previousRepostState };
        latestPostRef.current = rollbackPost;
        setPost(rollbackPost);
        onPostUpdated?.(rollbackPost);
      }
      const message = toggleError instanceof Error ? toggleError.message : '리포스트 상태를 변경하지 못했습니다.';
      setRepostError(message);
      toast.error(message);
    } finally {
      setIsRepostLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!post || post.postId !== postId || !commentText.trim() || submittingCommentRef.current) {
      return;
    }
    if (commentText.length > MAX_COMMENT_LENGTH) {
      return;
    }

    const submittedDraft = commentText;
    const submittedPostId = post.postId;
    const requestGeneration = commentRequestGenerationRef.current;
    submittingCommentRef.current = true;
    try {
      setSubmittingComment(true);
      const createdComment = await createComment(submittedPostId, submittedDraft.trim());
      const currentPost = latestPostRef.current;
      if (
        commentRequestGenerationRef.current !== requestGeneration
        || !currentPost
        || currentPost.postId !== submittedPostId
      ) {
        return;
      }
      const nextPost = {
        ...currentPost,
        comments: currentPost.comments + 1,
      };

      latestPostRef.current = nextPost;
      setPost(nextPost);
      setComments((current) => [createdComment, ...current]);
      setCommentText((current) => current === submittedDraft ? '' : current);
      onPostUpdated?.(nextPost);
    } catch (commentError) {
      if (commentRequestGenerationRef.current === requestGeneration) {
        toast.error(commentError instanceof Error ? commentError.message : '댓글을 작성하지 못했습니다.');
      }
    } finally {
      if (commentRequestGenerationRef.current === requestGeneration) {
        submittingCommentRef.current = false;
        setSubmittingComment(false);
      }
    }
  };

  const handleDeleteComment = async (comment: CommentRecord) => {
    if (!post || deletingCommentId || deleteCommentLockRef.current) {
      return;
    }

    deleteCommentLockRef.current = true;
    const returnFocusTo = commentMenuButtonRefs.current.get(comment.commentId) ?? null;
    setCommentMenuOpenId(null);
    try {
      const confirmed = await confirm({
        message: '댓글을 삭제할까요?', confirmLabel: '삭제', danger: true, returnFocusTo,
      });
      if (!confirmed) return;
      setDeletingCommentId(comment.commentId);
      await deleteComment(post.postId, comment.commentId);
      setComments((current) => current.filter((item) => item.commentId !== comment.commentId));
      const nextPost = {
        ...(latestPostRef.current ?? post),
        comments: Math.max(0, (latestPostRef.current ?? post).comments - 1),
      };
      setPost(nextPost);
      onPostUpdated?.(nextPost);
      setCommentMenuOpenId(null);
      window.requestAnimationFrame(() => {
        if (!returnFocusTo?.isConnected && document.activeElement === document.body) {
          restoreFeedbackFocus(null);
        }
      });
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : '댓글을 삭제하지 못했습니다.');
    } finally {
      deleteCommentLockRef.current = false;
      setDeletingCommentId(null);
    }
  };

  const handleBookmarkStateChange = async (
    nextBookmarked: boolean,
    options: { skipRequest?: boolean } = {},
  ) => {
    if (!post || bookmarking) {
      return false;
    }

    if (nextBookmarked === bookmarked) {
      return true;
    }

    const currentPost = latestPostRef.current ?? post;
    const nextPost = updatePostBookmarkState(currentPost, nextBookmarked);
    const previousBookmarked = currentPost.bookmarkedByMe;

    setBookmarked(nextBookmarked);
    latestPostRef.current = nextPost;
    setPost(nextPost);
    onPostUpdated?.(nextPost);

    if (options.skipRequest) {
      return true;
    }

    try {
      setBookmarking(true);
      if (nextBookmarked) {
        await bookmarkPost(currentPost.postId);
      } else {
        await unbookmarkPost(currentPost.postId);
      }
      return true;
    } catch (bookmarkError) {
      const rollbackPost = latestPostRef.current
        ? updatePostBookmarkState(latestPostRef.current, previousBookmarked)
        : null;

      setBookmarked(previousBookmarked);
      if (rollbackPost) {
        latestPostRef.current = rollbackPost;
        setPost(rollbackPost);
        onPostUpdated?.(rollbackPost);
      }
      toast.error(bookmarkError instanceof Error ? bookmarkError.message : '북마크 상태를 변경하지 못했습니다.');
      return false;
    } finally {
      setBookmarking(false);
    }
  };

  const handleDeletePost = async () => {
    if (!post || post.postId !== postId || deletingPost || deletePostLockRef.current) {
      return;
    }

    deletePostLockRef.current = true;
    const submittedPostId = post.postId;
    const isCurrent = () => actionLifetime.active;
    closeMenu();
    try {
      const confirmed = await confirm({
        message: '게시물을 삭제할까요?', confirmLabel: '삭제', danger: true,
        returnFocusTo: menuTriggerRef.current,
      });
      if (!confirmed || !isCurrent()) return;
      setDeletingPost(true);
      await deletePost(submittedPostId);
      if (!isCurrent()) return;
      closeMenu();
      if (onPostDeleted) onPostDeleted(submittedPostId);
      else onBack();
    } catch (deleteError) {
      if (isCurrent()) toast.error(deleteError instanceof Error ? deleteError.message : '게시물을 삭제하지 못했습니다.');
    } finally {
      if (isCurrent()) {
        deletePostLockRef.current = false;
        setDeletingPost(false);
      }
    }
  };

  if (loading) {
    return <div className="mx-auto max-w-3xl pb-20 text-center font-black text-zinc-400">게시물을 불러오는 중...</div>;
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 pb-20 text-center">
        <button onClick={onBack} className="font-black text-zinc-500 hover:text-black">
          돌아가기
        </button>
        <p className="font-black text-red-500">{error ?? '게시물을 찾을 수 없습니다.'}</p>
        <Link
          href="/home"
          className="inline-flex rounded-xl bg-black px-5 py-3 text-sm font-black text-white transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  const canDeletePost = post.mine || Boolean(user?.handle && user.handle === post.authorHandle);
  const canReportPost = !canDeletePost;
  const canRepostPost = !post.mine;
  const repostButtonTitle = post.mine
    ? '본인 게시글은 리포스트할 수 없습니다.'
    : repostError ?? undefined;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-3xl pb-20">
      <button
        onClick={onBack}
        className="group mb-8 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-zinc-400 transition-all hover:text-black"
      >
        <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />
        <span>피드로 돌아가기</span>
      </button>

      <article className="rounded-[40px] border border-zinc-100 bg-white shadow-sm">
        <div className="p-8">
          <div className="mb-8 flex items-center justify-between">
            <Link href={`/profile/${encodeURIComponent(post.authorHandle)}`} className="flex items-center gap-4">
              {post.authorProfileImageUrl ? (
                <div className="relative h-14 w-14 overflow-hidden rounded-[20px]">
                  <Image src={post.authorProfileImageUrl} alt={post.author} fill unoptimized className="object-cover" />
                </div>
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-black text-lg font-black text-white shadow-xl">
                  {getInitials(post.author)}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black tracking-tighter text-black">{post.author}</h2>
                  <MembershipBadge active={post.authorMembershipBadge} />
                </div>
                <p className="text-xs font-bold text-zinc-400">
                  @{post.authorHandle} · <RelativeTime createdAt={post.createdAt} />
                </p>
              </div>
            </Link>
            <div className="relative">
              <button
                type="button"
                ref={menuTriggerRef}
                onClick={toggleMenu}
                className="rounded-2xl p-3 text-zinc-300 transition-all hover:bg-zinc-50 hover:text-black dark:hover:bg-neutral-800"
                aria-label="게시물 메뉴"
                aria-expanded={menuOpen}
                aria-controls={menuOpen ? menuId : undefined}
              >
                <MoreHorizontal size={24} />
              </button>

              {menuOpen ? (
                <div ref={menuPanelRef} id={menuId} className="absolute right-0 top-12 z-30 min-w-36 overflow-hidden rounded-2xl border border-zinc-100 bg-white py-1 shadow-xl">
                  {canReportPost ? (
                    <button
                      type="button"
                      onClick={() => {
                        closeMenu();
                        setReportPostOpen(true);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-black text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                    >
                      <Flag size={15} />
                      게시물 신고
                    </button>
                  ) : null}

                  {canDeletePost ? (
                    <button
                      type="button"
                      onClick={handleDeletePost}
                      disabled={deletingPost}
                      className="w-full px-4 py-3 text-left text-sm font-black text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                    >
                      {deletingPost ? '삭제 중...' : '삭제'}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={closeMenu}
                    className="w-full px-4 py-3 text-left text-sm font-black text-zinc-500 transition hover:bg-zinc-50 dark:hover:bg-neutral-800 dark:hover:!text-zinc-100"
                  >
                    취소
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {post.content ? (
            <p className="mb-8 text-lg font-medium leading-relaxed text-zinc-800">
              <HashtagText text={post.content} />
            </p>
          ) : null}

          {post.media.length > 0 ? (
            <div className="mb-8 space-y-3">
              {post.media.map((item, index) =>
                item.mediaType === 'VIDEO' ? (
                  <video
                    key={item.mediaId}
                    controls
                    poster={item.thumbnailUrl ?? undefined}
                    src={item.mediaUrl}
                    className="max-h-[520px] w-full rounded-[24px] bg-black object-cover"
                  />
                ) : (
                  <div key={`${post.postId}:${item.mediaId}`} className="relative overflow-hidden rounded-[24px] border border-zinc-50">
                    <PostImage
                      src={item.mediaUrl}
                      imageNumber={index + 1}
                      width={1400}
                      height={1000}
                      className="h-auto max-h-[520px] w-full object-cover"
                    />
                  </div>
                )
              )}
            </div>
          ) : null}

          <div className="flex items-center justify-between border-y border-zinc-50 py-6">
            <div className="flex items-center gap-8">
              <button
                type="button"
                onClick={handleToggleLike}
                aria-label={`좋아요 ${post.likes}개`}
                aria-pressed={post.likedByMe}
                disabled={isLikeLoading}
                className={`flex items-center gap-2 text-sm font-black transition-all ${
                  post.likedByMe ? 'text-red-500' : 'text-zinc-400 hover:text-black'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <Heart size={22} className={post.likedByMe ? 'fill-red-500' : ''} />
                <span>{post.likes}</span>
              </button>
              <div className="flex items-center gap-2 text-sm font-black text-zinc-400">
                <MessageCircle size={22} />
                <span>{post.comments}</span>
              </div>
              <button
                type="button"
                onClick={() => void handleToggleRepost()}
                disabled={isRepostLoading || !canRepostPost}
                aria-label="리포스트"
                aria-pressed={post.isReposted}
                aria-describedby={repostButtonTitle ? `${menuId}-repost-reason` : undefined}
                title={repostButtonTitle}
                className={`flex items-center gap-2 text-sm font-black transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                  post.isReposted ? 'text-emerald-500' : 'text-zinc-400 hover:text-emerald-500'
                }`}
              >
                <Repeat2 size={22} />
                <span>{post.repostCount}</span>
              </button>
              {repostButtonTitle ? <span id={`${menuId}-repost-reason`} className="sr-only">{repostButtonTitle}</span> : null}
              <button
                type="button"
                onClick={() => { closeAll(); setCollectionModalOpen(true); }}
                aria-haspopup="dialog"
                aria-label={bookmarked ? '북마크 해제' : '북마크 저장'}
                disabled={bookmarking}
                className={`flex items-center gap-2 text-sm font-black transition-all ${
                  bookmarked ? 'text-black' : 'text-zinc-400 hover:text-black'
                }`}
              >
                <Bookmark size={22} className={bookmarked ? 'fill-black dark:fill-[#f5b93d]' : ''} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => { closeAll(); setShareOpen(true); }}
              className="text-zinc-400 transition-all hover:text-black"
              aria-label="게시물 공유"
            >
              <Send size={22} />
            </button>
          </div>

          <div id="comments" ref={commentsSectionRef} className="mt-10 scroll-mt-24 space-y-8">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-xs font-black text-zinc-500">
                나
              </div>
              <form
                className="relative flex-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSubmitComment();
                }}
              >
                <textarea
                  aria-label="댓글 입력"
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  onCompositionStart={() => {
                    clearCommentCompositionGuard();
                    commentComposingRef.current = true;
                  }}
                  onCompositionEnd={() => {
                    commentComposingRef.current = false;
                    clearCommentCompositionGuard();
                    // Windows IME can end composition before dispatching the same Enter.
                    // Protect only this event turn, not the user's next deliberate Enter.
                    commentCompositionEndedRef.current = true;
                    commentCompositionTimerRef.current = setTimeout(clearCommentCompositionGuard, 0);
                  }}
                  onBlur={() => {
                    commentComposingRef.current = false;
                    clearCommentCompositionGuard();
                  }}
                  onKeyUp={(event) => {
                    if (event.key === 'Enter') clearCommentCompositionGuard();
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') {
                      clearCommentCompositionGuard();
                      return;
                    }
                    if (event.shiftKey) {
                      clearCommentCompositionGuard();
                      return;
                    }
                    if (commentComposingRef.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
                    if (commentCompositionEndedRef.current) {
                      event.preventDefault();
                      clearCommentCompositionGuard();
                      return;
                    }
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }}
                  maxLength={MAX_COMMENT_LENGTH}
                  placeholder="댓글을 남겨보세요..."
                  className="w-full resize-none rounded-2xl border-none bg-zinc-50 px-5 py-4 text-[15px] font-medium text-black transition-all focus:ring-2 focus:ring-black dark:placeholder:!text-zinc-400 dark:focus:ring-[#f5b93d]"
                  rows={3}
                />
                <span
                  className={`absolute bottom-4 right-14 text-xs font-bold ${
                    commentText.length >= MAX_COMMENT_LENGTH ? 'text-red-500' : 'text-zinc-400'
                  }`}
                >
                  {commentText.length}/{MAX_COMMENT_LENGTH}
                </span>
                <button
                  type="submit"
                  aria-label="댓글 전송"
                  disabled={!commentText.trim() || submittingComment}
                  className="absolute bottom-4 right-4 rounded-xl bg-black p-2 text-white transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:disabled:bg-neutral-800 dark:disabled:text-zinc-500"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>

            <div className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-sm font-bold text-zinc-400">아직 댓글이 없습니다.</p>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.commentId}
                    ref={(element) => {
                      if (element) {
                        commentRefs.current.set(comment.commentId, element);
                      } else {
                        commentRefs.current.delete(comment.commentId);
                      }
                    }}
                    data-comment-id={comment.commentId}
                    className={`scroll-mt-24 rounded-2xl border p-4 transition-colors duration-500 ${
                      initialCommentId === comment.commentId && highlightedCommentId === comment.commentId
                        ? 'border-sky-300 bg-sky-50 dark:border-sky-500 dark:bg-sky-500/10'
                        : 'border-zinc-100 bg-zinc-50 dark:border-neutral-800 dark:bg-neutral-900'
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-sm font-black text-black">
                          {comment.author}
                          <MembershipBadge active={comment.authorMembershipBadge} />
                        </span>
                        <span className="text-xs font-bold text-zinc-400">
                          @{comment.authorHandle} · <RelativeTime createdAt={comment.createdAt} />
                        </span>
                      </div>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setCommentMenuOpenId((current) =>
                              current === comment.commentId ? null : comment.commentId
                            )
                          }
                          className="rounded-lg p-1 text-zinc-300 transition hover:bg-white hover:text-black dark:hover:bg-neutral-800"
                          aria-label="댓글 메뉴"
                          ref={(element) => {
                            if (element) commentMenuButtonRefs.current.set(comment.commentId, element);
                            else commentMenuButtonRefs.current.delete(comment.commentId);
                          }}
                          aria-expanded={commentMenuOpenId === comment.commentId}
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        {commentMenuOpenId === comment.commentId ? (
                          <div className="absolute right-0 top-8 z-30 min-w-36 overflow-hidden rounded-2xl border border-zinc-100 bg-white py-1 shadow-xl">
                            {comment.mine ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(comment)}
                                disabled={deletingCommentId === comment.commentId}
                                className="w-full px-4 py-3 text-left text-sm font-black text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                              >
                                {deletingCommentId === comment.commentId ? '삭제 중...' : '삭제'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setCommentMenuOpenId(null);
                                  setReportComment(comment);
                                }}
                                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-black text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                              >
                                <Flag size={15} />
                                댓글 신고
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setCommentMenuOpenId(null)}
                              className="w-full px-4 py-3 text-left text-sm font-black text-zinc-500 transition hover:bg-zinc-50 dark:hover:bg-neutral-800 dark:hover:!text-zinc-100"
                            >
                              취소
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-sm font-medium text-zinc-700"><HashtagText text={comment.content} linkHashtags={false} /></p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </article>

      {shareOpen ? (
        <SharePostModal
          post={post}
          onClose={() => setShareOpen(false)}
          onShared={(sharedPost) => {
            const currentPost = latestPostRef.current;
            if (!actionLifetime.active || !currentPost ||
                currentPost.postId !== sharedPost.postId || currentPost.postId !== postId) return;
            const updatedPost = { ...currentPost, shares: sharedPost.shares };
            latestPostRef.current = updatedPost;
            setPost(updatedPost);
            onPostUpdated?.(updatedPost);
          }}
        />
      ) : null}

      {reportComment ? (
        <ReportContentModal
          targetType="COMMENT"
          targetId={reportComment.commentId}
          title="댓글 신고"
          author={reportComment.author}
          authorHandle={reportComment.authorHandle}
          content={reportComment.content}
          emptyContentLabel="댓글 내용 없음"
          onClose={() => setReportComment(null)}
        />
      ) : null}
      {reportPostOpen ? (
        <ReportContentModal
          targetType="POST"
          targetId={post.postId}
          title="게시물 신고"
          author={post.author}
          authorHandle={post.authorHandle}
          content={post.content}
          emptyContentLabel="미디어 게시글"
          onClose={() => setReportPostOpen(false)}
        />
      ) : null}

      {post ? (
        <SaveToCollectionModal
          isOpen={collectionModalOpen}
          postId={post.postId}
          isBookmarked={bookmarked}
          onClose={() => setCollectionModalOpen(false)}
          onBookmarkStateChange={handleBookmarkStateChange}
        />
      ) : null}
    </motion.div>
  );
}
