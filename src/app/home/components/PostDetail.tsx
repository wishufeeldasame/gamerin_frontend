'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Bookmark, Heart, MessageCircle, MoreHorizontal, Send } from 'lucide-react';
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
  unbookmarkPost,
  unlikePost,
  updatePostBookmarkState,
  updatePostLikeState,
} from '@/lib/feed-api';
import { SharePostModal } from './SharePostModal';

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
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
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
    if (!post) {
      return;
    }

    const nextPost = updatePostLikeState(post);

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
    }
  };

  const handleSubmitComment = async () => {
    if (!post || !commentText.trim() || submittingComment) {
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

  const handleToggleBookmark = async () => {
    if (!post || bookmarking) {
      return;
    }

    const nextBookmarked = !bookmarked;
    const nextPost = updatePostBookmarkState(post, nextBookmarked);

    setBookmarked(nextBookmarked);
    setPost(nextPost);
    onPostUpdated?.(nextPost);

    try {
      setBookmarking(true);
      if (nextBookmarked) {
        await bookmarkPost(post.postId);
      } else {
        await unbookmarkPost(post.postId);
      }
    } catch (bookmarkError) {
      setBookmarked(bookmarked);
      setPost(post);
      onPostUpdated?.(post);
      alert(bookmarkError instanceof Error ? bookmarkError.message : 'Failed to update bookmark.');
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-3xl pb-20">
      <button
        onClick={onBack}
        className="group mb-8 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-zinc-400 transition-all hover:text-black"
      >
        <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />
        <span>Back to Feed</span>
      </button>

      <article className="overflow-hidden rounded-[40px] border border-zinc-100 bg-white shadow-sm">
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
                onClick={() => {
                  if (canDeletePost) {
                    setMenuOpen((current) => !current);
                  }
                }}
                className="rounded-2xl p-3 text-zinc-300 transition-all hover:bg-zinc-50 hover:text-black disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-zinc-300"
                aria-label="게시물 메뉴"
                aria-expanded={menuOpen}
                disabled={!canDeletePost}
              >
                <MoreHorizontal size={24} />
              </button>

              {menuOpen && canDeletePost ? (
                <div className="absolute right-0 top-12 z-30 min-w-28 overflow-hidden rounded-2xl border border-zinc-100 bg-white py-1 shadow-xl">
                  <button
                    type="button"
                    onClick={handleDeletePost}
                    disabled={deletingPost}
                    className="w-full px-4 py-3 text-left text-sm font-black text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
                  >
                    {deletingPost ? '삭제 중...' : '삭제'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {post.content ? <p className="mb-8 text-lg font-medium leading-relaxed text-zinc-800">{post.content}</p> : null}

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
                className={`flex items-center gap-2 text-sm font-black transition-all ${
                  post.likedByMe ? 'text-red-500' : 'text-zinc-400 hover:text-black'
                }`}
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
                onClick={handleToggleBookmark}
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
                  placeholder="Share your thoughts..."
                  className="w-full resize-none rounded-2xl border-none bg-zinc-50 px-5 py-4 text-[15px] font-medium text-black transition-all focus:ring-2 focus:ring-black"
                  rows={3}
                />
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
                      {comment.mine ? (
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
                            <div className="absolute right-0 top-8 z-30 min-w-28 overflow-hidden rounded-2xl border border-zinc-100 bg-white py-1 shadow-xl">
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(comment)}
                                disabled={deletingCommentId === comment.commentId}
                                className="w-full px-4 py-3 text-left text-sm font-black text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
                              >
                                {deletingCommentId === comment.commentId ? '삭제 중...' : '삭제'}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
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
    </motion.div>
  );
}
