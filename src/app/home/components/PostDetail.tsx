'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Bookmark, Flag, Heart, MessageCircle, MoreHorizontal, Repeat2, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
  formatRelativeTime,
  getInitials,
  likePost,
  repostPost,
  unbookmarkPost,
  unlikePost,
  unrepostPost,
  updatePostBookmarkState,
  updatePostLikeState,
} from '@/lib/feed-api';
import { SharePostModal } from './SharePostModal';
import SaveToCollectionModal from './SaveToCollectionModal';
import { ReportContentModal } from './Report';
import { HashtagText } from './HashtagText';

const MAX_COMMENT_LENGTH = 300;

interface PostDetailProps {
  postId: string;
  onBack: () => void;
  initialScrollTarget?: 'comments';
  onPostUpdated?: (post: PostRecord) => void;
  onPostDeleted?: (postId: string) => void;
}

export function PostDetail({ postId, onBack, initialScrollTarget, onPostUpdated, onPostDeleted }: PostDetailProps) {
  const { user } = useAuth();
  const commentsSectionRef = useRef<HTMLDivElement | null>(null);
  const scrolledToCommentsRef = useRef(false);
  const [post, setPost] = useState<PostRecord | null>(null);
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [commentMenuOpenId, setCommentMenuOpenId] = useState<string | null>(null);
  const [reportComment, setReportComment] = useState<CommentRecord | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportPostOpen, setReportPostOpen] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [isRepostLoading, setIsRepostLoading] = useState(false);
  const [repostError, setRepostError] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    scrolledToCommentsRef.current = false;
  }, [postId, initialScrollTarget]);

  useEffect(() => {
    if (loading || !post || initialScrollTarget !== 'comments' || scrolledToCommentsRef.current) {
      return;
    }

    scrolledToCommentsRef.current = true;
    window.requestAnimationFrame(() => {
      commentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [initialScrollTarget, loading, post]);

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
          setBookmarked(detail.bookmarkedByMe);
        }
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return;
        }

        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load post.');
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

  const handleToggleLike = async () => {
    if (!post || isLikeLoading) {
      return;
    }

    const nextPost = updatePostLikeState(post);
    setIsLikeLoading(true);

    setPost(nextPost);
    onPostUpdated?.(nextPost);

    try {
      if (post.likedByMe) {
        await unlikePost(post.postId);
      } else {
        await likePost(post.postId);
      }
    } catch (likeError) {
      setPost(post);
      onPostUpdated?.(post);
      alert(likeError instanceof Error ? likeError.message : 'Failed to update like.');
    } finally {
      setIsLikeLoading(false);
    }
  };

  const handleToggleRepost = async () => {
    if (!post || isRepostLoading || post.mine) {
      return;
    }

    const previousPost = post;
    const optimisticPost = {
      ...post,
      isReposted: !post.isReposted,
      repostCount: Math.max(0, post.repostCount + (post.isReposted ? -1 : 1)),
    };

    setIsRepostLoading(true);
    setRepostError(null);
    setPost(optimisticPost);
    onPostUpdated?.(optimisticPost);

    try {
      const response = optimisticPost.isReposted
        ? await repostPost(previousPost.postId)
        : await unrepostPost(previousPost.postId);
      const confirmedPost = {
        ...previousPost,
        isReposted: response.isReposted,
        repostCount: response.repostCount,
      };

      setPost(confirmedPost);
      onPostUpdated?.(confirmedPost);
    } catch (toggleError) {
      setPost(previousPost);
      onPostUpdated?.(previousPost);
      const message = toggleError instanceof Error ? toggleError.message : 'Failed to update repost.';
      setRepostError(message);
      alert(message);
    } finally {
      setIsRepostLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!post || !commentText.trim() || submittingComment) {
      return;
    }
    if (commentText.length > MAX_COMMENT_LENGTH) {
      return;
    }

    try {
      setSubmittingComment(true);
      const createdComment = await createComment(post.postId, commentText.trim());
      const nextPost = {
        ...post,
        comments: post.comments + 1,
      };

      setPost(nextPost);
      setComments((current) => [createdComment, ...current]);
      setCommentText('');
      onPostUpdated?.(nextPost);
    } catch (commentError) {
      alert(commentError instanceof Error ? commentError.message : 'Failed to create comment.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (comment: CommentRecord) => {
    if (!post || deletingCommentId) {
      return;
    }

    const confirmed = window.confirm('댓글을 삭제할까요?');
    if (!confirmed) {
      setCommentMenuOpenId(null);
      return;
    }

    try {
      setDeletingCommentId(comment.commentId);
      await deleteComment(post.postId, comment.commentId);
      setComments((current) => current.filter((item) => item.commentId !== comment.commentId));
      const nextPost = {
        ...post,
        comments: Math.max(0, post.comments - 1),
      };
      setPost(nextPost);
      onPostUpdated?.(nextPost);
      setCommentMenuOpenId(null);
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : '댓글 삭제에 실패했습니다.');
    } finally {
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

    const nextPost = updatePostBookmarkState(post, nextBookmarked);

    setBookmarked(nextBookmarked);
    setPost(nextPost);
    onPostUpdated?.(nextPost);

    if (options.skipRequest) {
      return true;
    }

    try {
      setBookmarking(true);
      if (nextBookmarked) {
        await bookmarkPost(post.postId);
      } else {
        await unbookmarkPost(post.postId);
      }
      return true;
    } catch (bookmarkError) {
      setBookmarked(bookmarked);
      setPost(post);
      onPostUpdated?.(post);
      alert(bookmarkError instanceof Error ? bookmarkError.message : 'Failed to update bookmark.');
      return false;
    } finally {
      setBookmarking(false);
    }
  };

  const handleDeletePost = async () => {
    if (!post || deletingPost) {
      return;
    }

    const confirmed = window.confirm('게시물을 삭제할까요?');
    if (!confirmed) {
      setMenuOpen(false);
      return;
    }

    try {
      setDeletingPost(true);
      await deletePost(post.postId);
      setMenuOpen(false);
      onPostDeleted?.(post.postId);
      onBack();
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : '게시물 삭제에 실패했습니다.');
    } finally {
      setDeletingPost(false);
    }
  };

  if (loading) {
    return <div className="mx-auto max-w-3xl pb-20 text-center font-black text-zinc-400">Loading post...</div>;
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 pb-20 text-center">
        <button onClick={onBack} className="font-black text-zinc-500 hover:text-black">
          Back
        </button>
        <p className="font-black text-red-500">{error ?? 'Post not found.'}</p>
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
        <span>Back to Feed</span>
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
                </div>
                <p className="text-xs font-bold text-zinc-400">
                  @{post.authorHandle} · {formatRelativeTime(post.createdAt)}
                </p>
              </div>
            </Link>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((current) => !current)}
                className="rounded-2xl p-3 text-zinc-300 transition-all hover:bg-zinc-50 hover:text-black"
                aria-label="게시물 메뉴"
                aria-expanded={menuOpen}
              >
                <MoreHorizontal size={24} />
              </button>

              {menuOpen ? (
                <div className="absolute right-0 top-12 z-30 min-w-36 overflow-hidden rounded-2xl border border-zinc-100 bg-white py-1 shadow-xl">
                  {canReportPost ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setReportPostOpen(true);
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
                      onClick={handleDeletePost}
                      disabled={deletingPost}
                      className="w-full px-4 py-3 text-left text-sm font-black text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
                    >
                      {deletingPost ? '삭제 중...' : '삭제'}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    className="w-full px-4 py-3 text-left text-sm font-black text-zinc-500 transition hover:bg-zinc-50"
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
              {post.media.map((item) =>
                item.mediaType === 'VIDEO' ? (
                  <video
                    key={item.mediaId}
                    controls
                    poster={item.thumbnailUrl ?? undefined}
                    src={item.mediaUrl}
                    className="max-h-[520px] w-full rounded-[24px] bg-black object-cover"
                  />
                ) : (
                  <div key={item.mediaId} className="relative overflow-hidden rounded-[24px] border border-zinc-50">
                    <Image
                      src={item.mediaUrl}
                      alt="Post media"
                      width={1400}
                      height={1000}
                      unoptimized
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
                onClick={handleToggleLike}
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
                aria-label={post.isReposted ? '리포스트 취소' : '리포스트'}
                title={repostButtonTitle}
                className={`flex items-center gap-2 text-sm font-black transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                  post.isReposted ? 'text-emerald-500' : 'text-zinc-400 hover:text-emerald-500'
                }`}
              >
                <Repeat2 size={22} />
                <span>{post.repostCount}</span>
              </button>
              <button
                type="button"
                onClick={() => setCollectionModalOpen(true)}
                disabled={bookmarking}
                className={`flex items-center gap-2 text-sm font-black transition-all ${
                  bookmarked ? 'text-black' : 'text-zinc-400 hover:text-black'
                }`}
              >
                <Bookmark size={22} className={bookmarked ? 'fill-black' : ''} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="text-zinc-400 transition-all hover:text-black"
              aria-label="게시물 공유"
            >
              <Send size={22} />
            </button>
          </div>

          <div ref={commentsSectionRef} className="mt-10 scroll-mt-24 space-y-8">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-xs font-black text-zinc-500">
                ME
              </div>
              <div className="relative flex-1">
                <textarea
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  maxLength={MAX_COMMENT_LENGTH}
                  placeholder="Share your thoughts..."
                  className="w-full resize-none rounded-2xl border-none bg-zinc-50 px-5 py-4 text-[15px] font-medium text-black transition-all focus:ring-2 focus:ring-black"
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
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim() || submittingComment}
                  className="absolute bottom-4 right-4 rounded-xl bg-black p-2 text-white transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-300"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-sm font-bold text-zinc-400">No comments yet.</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.commentId} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-black">{comment.author}</span>
                        <span className="text-xs font-bold text-zinc-400">
                          @{comment.authorHandle} · {formatRelativeTime(comment.createdAt)}
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
                          className="rounded-lg p-1 text-zinc-300 transition hover:bg-white hover:text-black"
                          aria-label="댓글 메뉴"
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
                                className="w-full px-4 py-3 text-left text-sm font-black text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
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
                                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-black text-red-500 transition hover:bg-red-50"
                              >
                                <Flag size={15} />
                                댓글 신고
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setCommentMenuOpenId(null)}
                              className="w-full px-4 py-3 text-left text-sm font-black text-zinc-500 transition hover:bg-zinc-50"
                            >
                              취소
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-sm font-medium text-zinc-700">{comment.content}</p>
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
            setPost(sharedPost);
            onPostUpdated?.(sharedPost);
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
