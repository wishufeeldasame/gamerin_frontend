'use client';

import { useToast } from '@/app/context/ToastContext';
import { restoreFeedbackFocus, useConfirm } from '@/app/context/ConfirmContext';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bookmark, ChevronLeft, Flag, Heart, MessageCircle, MoreHorizontal, Repeat2, Share } from 'lucide-react';
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
  fetchPostDetailByNumber,
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
import { RelatedHashtagPosts } from './RelatedHashtagPosts';
import { PostImage } from './PostImage';
import { usePostLike } from '@/hooks/usePostLike';
import { MembershipBadge } from './MembershipBadge';
import { EditPostModal, canEditPost, requestPostEdit } from './EditPostModal';

const MAX_COMMENT_LENGTH = 300;
const MENU_DANGER_ITEM = 'flex h-10 w-full items-center gap-2 rounded-md px-3 text-left text-label text-fg-danger transition hover:bg-danger-subtle disabled:cursor-not-allowed disabled:opacity-50';
const MENU_CANCEL_ITEM = 'flex h-10 w-full items-center rounded-md px-3 text-left text-label text-fg-secondary transition hover:bg-subtle hover:text-fg-primary';

interface PostDetailProps {
  postNumber: number;
  onBack: () => void;
  initialScrollTarget?: 'comments';
  initialCommentId?: string;
  onPostUpdated?: (post: PostRecord) => void;
  onPostDeleted?: (postId: string) => void;
}

export function PostDetail({
  postNumber,
  onBack,
  initialScrollTarget,
  initialCommentId,
  onPostUpdated,
  onPostDeleted,
}: PostDetailProps) {
  const toast = useToast();
  const confirm = useConfirm(String(postNumber));
  const deleteCommentLockRef = useRef(false);
  const deletePostLockRef = useRef(false);
  const commentMenuButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const { user } = useAuth();
  const router = useRouter();
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
  const actionLifetime = useMemo(() => ({ active: false, postNumber }), [postNumber]);
  useLayoutEffect(() => {
    actionLifetime.active = true;
    deletePostLockRef.current = false;
    setDeletingPost(false);
    return () => { actionLifetime.active = false; };
  }, [actionLifetime]);
  const [shareOpen, setShareOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
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
  const loadedPostNumber = post?.postNumber;
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
  }, [postNumber]);

  useEffect(() => {
    const scrollKey = JSON.stringify([postNumber, initialCommentId ?? null, initialScrollTarget ?? null]);
    if (loading || loadedPostNumber !== postNumber) {
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
  }, [initialCommentId, initialScrollTarget, loadedPostNumber, loading, postNumber]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadPost = async () => {
      try {
        setLoading(true);
        setError(null);
        setComments([]);
        // 댓글 API는 UUID를 쓰므로 상세를 먼저 받아 `detail.postId`로 조회한다
        const detail = await fetchPostDetailByNumber(postNumber, { signal: controller.signal });
        const commentList = await fetchPostComments(detail.postId, { signal: controller.signal });
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
          setError(loadError instanceof Error ? loadError.message : '게시글을 불러오지 못했습니다.');
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
  }, [postNumber]);

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
    if (!post || post.postNumber !== postNumber || !commentText.trim() || submittingCommentRef.current) {
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
    if (!post || post.postNumber !== postNumber || deletingPost || deletePostLockRef.current) {
      return;
    }

    deletePostLockRef.current = true;
    const submittedPostId = post.postId;
    const isCurrent = () => actionLifetime.active;
    closeMenu();
    try {
      const confirmed = await confirm({
        message: '게시글을 삭제할까요?', confirmLabel: '삭제', danger: true,
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
      if (isCurrent()) toast.error(deleteError instanceof Error ? deleteError.message : '게시글을 삭제하지 못했습니다.');
    } finally {
      if (isCurrent()) {
        deletePostLockRef.current = false;
        setDeletingPost(false);
      }
    }
  };

  // 모바일은 앱 상단 바 대신 이 헤더를 쓴다(F15). 웹앱 독립 실행에는 브라우저 뒤로가기가 없다.
  const header = (
    <div className="sticky top-0 z-20 flex items-center gap-1 bg-canvas px-2 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] lg:static lg:-ml-2 lg:px-0 lg:pb-4 lg:pt-0">
      <button type="button" onClick={onBack} className="btn-icon text-icon-primary" aria-label="뒤로 가기">
        <ChevronLeft size={24} strokeWidth={1.67} />
      </button>
      <h1 className="text-title text-fg-primary">게시물</h1>
    </div>
  );

  if (loading) {
    return (
      <div className="pb-20">
        {header}
        <p role="status" className="px-4 py-10 text-center text-body text-fg-tertiary">게시글을 불러오는 중...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="pb-20">
        {header}
        <div className="flex flex-col items-center gap-4 px-4 py-10 text-center">
          <p className="text-body text-fg-danger">{error ?? '게시글을 찾을 수 없습니다.'}</p>
          <Link href="/home" className="btn-secondary">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const canDeletePost = post.mine || Boolean(user?.handle && user.handle === post.authorHandle);
  const canReportPost = !canDeletePost;
  const editable = canEditPost(post);
  const canRepostPost = !post.mine;
  const repostButtonTitle = post.mine
    ? '본인 게시글은 리포스트할 수 없습니다.'
    : repostError ?? undefined;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-20">
      {header}

      <div className="space-y-3 px-4 md:px-0">
      <article className="rounded-card border border-line-card bg-surface">
        <div className="px-4 pb-2 pt-4 md:px-5 md:pt-5">
          <div className="mb-3 flex items-center justify-between">
            <Link href={`/profile/${encodeURIComponent(post.authorHandle)}`} className="flex min-w-0 items-center gap-3">
              {post.authorProfileImageUrl ? (
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
                  <Image src={post.authorProfileImageUrl} alt={post.author} fill unoptimized className="object-cover" />
                </div>
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-subtle text-label text-fg-secondary">
                  {getInitials(post.author)}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-1.5">
                  <h2 className="text-body font-medium text-fg-primary">{post.author}</h2>
                  <MembershipBadge active={post.authorMembershipBadge} />
                </div>
                <p className="text-caption text-fg-tertiary">
                  @{post.authorHandle} · <RelativeTime createdAt={post.createdAt} />
                </p>
              </div>
            </Link>
            <div className="relative">
              <button
                type="button"
                ref={menuTriggerRef}
                onClick={toggleMenu}
                className="btn-icon -mr-2"
                aria-label="게시글 메뉴"
                aria-expanded={menuOpen}
                aria-controls={menuOpen ? menuId : undefined}
              >
                <MoreHorizontal size={20} strokeWidth={1.67} />
              </button>

              {menuOpen ? (
                <div ref={menuPanelRef} id={menuId} className="absolute right-0 top-10 z-30 min-w-36 rounded-control bg-surface-elevated p-1 shadow-xl ring-1 ring-line">
                  {canReportPost ? (
                    <button
                      type="button"
                      onClick={() => {
                        closeMenu();
                        setReportPostOpen(true);
                      }}
                      className={MENU_DANGER_ITEM}
                    >
                      <Flag size={16} strokeWidth={1.67} />
                      게시글 신고
                    </button>
                  ) : null}

                  {editable ? (
                    <button
                      type="button"
                      onClick={() => {
                        closeMenu();
                        void requestPostEdit({
                          hasMembership: Boolean(user?.membershipBadge),
                          confirm,
                          goToMembership: () => router.push('/membership'),
                          openEditor: () => setEditOpen(true),
                          returnFocusTo: menuTriggerRef.current,
                        });
                      }}
                      className="flex h-10 w-full items-center rounded-md px-3 text-left text-label text-fg-primary transition hover:bg-subtle"
                    >
                      수정
                    </button>
                  ) : null}

                  {canDeletePost ? (
                    <button
                      type="button"
                      onClick={handleDeletePost}
                      disabled={deletingPost}
                      className={MENU_DANGER_ITEM}
                    >
                      {deletingPost ? '삭제 중...' : '삭제'}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={closeMenu}
                    className={MENU_CANCEL_ITEM}
                  >
                    취소
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {post.content ? (
            <p className="break-words text-body text-fg-primary">
              <HashtagText text={post.content} />
            </p>
          ) : null}

          {post.media.length > 0 ? (
            <div className="mt-3 space-y-2">
              {post.media.map((item, index) =>
                item.mediaType === 'VIDEO' ? (
                  <video
                    key={item.mediaId}
                    controls
                    playsInline
                    preload="metadata"
                    poster={item.thumbnailUrl ?? undefined}
                    src={item.mediaUrl}
                    className="max-h-[520px] w-full rounded-control bg-black object-contain"
                  />
                ) : (
                  <div key={`${post.postId}:${item.mediaId}`} className="relative overflow-hidden rounded-control bg-subtle">
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

        </div>

        {/* 액션 바는 Post 카드와 같은 모양이다(댓글 수는 이 화면에서 버튼이 아니다). */}
        <div className="flex items-center justify-between px-2 py-1 text-icon-secondary md:px-3 [&_button]:min-h-11 [&_button]:min-w-11 [&_button]:justify-center [&_button]:rounded-control [&_button]:px-2 [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-0 [&_button]:focus-visible:outline-fg-brand dark:[&_button]:focus-visible:outline-line-focus">
          <div className="flex items-center gap-1 md:gap-2">
            <button
              type="button"
              onClick={handleToggleLike}
              aria-label={`좋아요 ${post.likes}개`}
              aria-pressed={post.likedByMe}
              disabled={isLikeLoading}
              className={`group flex items-center gap-1.5 transition-colors ${
                post.likedByMe ? 'text-red-500' : 'hover:text-red-500'
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <Heart size={20} strokeWidth={1.67} className={post.likedByMe ? 'fill-red-500' : 'transition-all group-hover:fill-red-500'} />
              <span className="text-label text-fg-secondary">{post.likes}</span>
            </button>
            <div className="flex min-h-11 items-center gap-1.5 px-2">
              <MessageCircle size={20} strokeWidth={1.67} />
              <span className="text-label text-fg-secondary">{post.comments}</span>
            </div>
            <button
              type="button"
              onClick={() => void handleToggleRepost()}
              disabled={isRepostLoading || !canRepostPost}
              aria-label="리포스트"
              aria-pressed={post.isReposted}
              aria-describedby={repostButtonTitle ? `${menuId}-repost-reason` : undefined}
              title={repostButtonTitle}
              className={`flex items-center gap-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                post.isReposted ? 'text-fg-success' : 'hover:text-fg-success'
              }`}
            >
              <Repeat2 size={20} strokeWidth={1.67} />
              <span className="text-label text-fg-secondary">{post.repostCount}</span>
            </button>
            {repostButtonTitle ? <span id={`${menuId}-repost-reason`} className="sr-only">{repostButtonTitle}</span> : null}
          </div>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => { closeAll(); setCollectionModalOpen(true); }}
              aria-haspopup="dialog"
              aria-label={bookmarked ? '북마크 해제' : '북마크 저장'}
              disabled={bookmarking}
              className={`flex items-center transition-colors ${
                bookmarked ? 'text-icon-brand' : 'hover:text-icon-primary'
              }`}
            >
              <Bookmark size={20} strokeWidth={1.67} className={bookmarked ? 'fill-current' : undefined} />
            </button>
            <button
              type="button"
              onClick={() => { closeAll(); setShareOpen(true); }}
              className="flex items-center transition-colors hover:text-icon-primary"
              aria-label="게시글 공유"
            >
              <Share size={20} strokeWidth={1.67} />
            </button>
          </div>
        </div>
      </article>

      <section
        id="comments"
        ref={commentsSectionRef}
        aria-label="댓글"
        className="scroll-mt-24 rounded-card border border-line-card bg-surface px-4 pt-4 md:px-5 md:pt-5"
      >
            <div className="flex gap-3 pb-4">
              <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-subtle text-caption text-fg-secondary">
                {user?.profileImageUrl ? (
                  <Image src={user.profileImageUrl} alt={user.nickname} fill unoptimized sizes="36px" className="object-cover" />
                ) : (
                  getInitials(user?.nickname ?? '나')
                )}
              </div>
              <form
                className="flex flex-1 items-start gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSubmitComment();
                }}
              >
                <div className="min-w-0 flex-1">
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
                  className="block max-h-40 min-h-10 w-full resize-none rounded-control border border-line bg-subtle px-3.5 py-[7px] text-body text-fg-primary outline-none transition-colors [field-sizing:content] placeholder:text-fg-tertiary focus:border-line-focus"
                  rows={1}
                />
                {/* 빈 입력창에는 시안처럼 글자 수를 숨긴다. 좁은 화면에서 안내 문구가 두 줄로 꺾이지 않게 한다. */}
                {commentText ? (
                  <span
                    className={`mt-1 block text-right text-caption tabular-nums ${
                      commentText.length >= MAX_COMMENT_LENGTH ? 'text-fg-danger' : 'text-fg-tertiary'
                    }`}
                  >
                    {commentText.length}/{MAX_COMMENT_LENGTH}
                  </span>
                ) : null}
                </div>
                <button
                  type="submit"
                  disabled={!commentText.trim() || submittingComment}
                  className="btn-secondary"
                >
                  등록
                </button>
              </form>
            </div>

            <div className="divide-y divide-line border-t border-line">
              {comments.length === 0 ? (
                <p className="py-6 text-center text-body text-fg-tertiary">아직 댓글이 없습니다.</p>
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
                    className={`-mx-2 flex scroll-mt-24 gap-3 px-2 py-4 transition-colors duration-500 ${
                      initialCommentId === comment.commentId && highlightedCommentId === comment.commentId
                        ? 'rounded-control bg-brand-subtle'
                        : ''
                    }`}
                  >
                    {comment.authorProfileImageUrl ? (
                      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full">
                        <Image src={comment.authorProfileImageUrl} alt="" fill unoptimized sizes="36px" className="object-cover" />
                      </div>
                    ) : (
                      <div aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-subtle text-caption text-fg-secondary">
                        {getInitials(comment.author)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5">
                        <span className="inline-flex items-center gap-1 text-body font-medium text-fg-primary">
                          {comment.author}
                          <MembershipBadge active={comment.authorMembershipBadge} />
                        </span>
                        <span className="text-caption text-fg-tertiary">
                          @{comment.authorHandle} · <RelativeTime createdAt={comment.createdAt} />
                        </span>
                      </div>
                      <div className="relative -my-2 -mr-2">
                        <button
                          type="button"
                          onClick={() =>
                            setCommentMenuOpenId((current) =>
                              current === comment.commentId ? null : comment.commentId
                            )
                          }
                          className="btn-icon"
                          aria-label="댓글 메뉴"
                          ref={(element) => {
                            if (element) commentMenuButtonRefs.current.set(comment.commentId, element);
                            else commentMenuButtonRefs.current.delete(comment.commentId);
                          }}
                          aria-expanded={commentMenuOpenId === comment.commentId}
                        >
                          <MoreHorizontal size={18} strokeWidth={1.67} />
                        </button>
                        {commentMenuOpenId === comment.commentId ? (
                          <div className="absolute right-0 top-10 z-30 min-w-36 rounded-control bg-surface-elevated p-1 shadow-xl ring-1 ring-line">
                            {comment.mine ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(comment)}
                                disabled={deletingCommentId === comment.commentId}
                                className={MENU_DANGER_ITEM}
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
                                className={MENU_DANGER_ITEM}
                              >
                                <Flag size={16} strokeWidth={1.67} />
                                댓글 신고
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setCommentMenuOpenId(null)}
                              className={MENU_CANCEL_ITEM}
                            >
                              취소
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-body text-fg-primary"><HashtagText text={comment.content} linkHashtags={false} /></p>
                    </div>
                  </div>
                ))
              )}
            </div>
      </section>
      </div>

      <RelatedHashtagPosts content={post.content} excludePostId={post.postId} />

      {shareOpen ? (
        <SharePostModal
          post={post}
          onClose={() => setShareOpen(false)}
          onShared={(sharedPost) => {
            const currentPost = latestPostRef.current;
            if (!actionLifetime.active || !currentPost ||
                currentPost.postId !== sharedPost.postId || currentPost.postNumber !== postNumber) return;
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
      {editOpen ? (
        <EditPostModal
          post={post}
          onClose={() => setEditOpen(false)}
          onSaved={(saved) => {
            const current = latestPostRef.current ?? post;
            // 좋아요·북마크 등 최신 화면 상태는 유지하고 본문과 수정 정보만 바꾼다.
            const nextPost = { ...current, content: saved.content, editCount: saved.editCount, editableUntil: saved.editableUntil };
            latestPostRef.current = nextPost;
            setPost(nextPost);
            onPostUpdated?.(nextPost);
            setEditOpen(false);
            toast.success('게시글을 수정했습니다.');
          }}
        />
      ) : null}
      {reportPostOpen ? (
        <ReportContentModal
          targetType="POST"
          targetId={post.postId}
          title="게시글 신고"
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
