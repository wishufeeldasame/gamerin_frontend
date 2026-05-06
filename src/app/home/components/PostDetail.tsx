'use client';

import Image from 'next/image';
import { ArrowLeft, Heart, MessageCircle, Share2, MoreHorizontal, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CommentRecord,
  PostRecord,
  createComment,
  fetchPostDetail,
  formatRelativeTime,
  getInitials,
  likePost,
  unlikePost,
} from '@/lib/feed-api';
import { SharePostModal } from './SharePostModal';

interface PostDetailProps {
  postId: string;
  onBack: () => void;
  onPostUpdated?: (post: PostRecord) => void;
}

export function PostDetail({ postId, onBack, onPostUpdated }: PostDetailProps) {
  const [post, setPost] = useState<PostRecord | null>(null);
  const [submittedComments, setSubmittedComments] = useState<CommentRecord[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPost = async () => {
      try {
        setLoading(true);
        setError(null);
        const detail = await fetchPostDetail(postId);
        if (!cancelled) {
          setPost(detail);
        }
      } catch (loadError) {
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
    };
  }, [postId]);

  const handleToggleLike = async () => {
    if (!post) {
      return;
    }

    const nextPost = {
      ...post,
      likedByMe: !post.likedByMe,
      likes: post.likes + (post.likedByMe ? -1 : 1),
    };

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
      setSubmittedComments((current) => [createdComment, ...current]);
      setCommentText('');
      onPostUpdated?.(nextPost);
    } catch (commentError) {
      alert(commentError instanceof Error ? commentError.message : 'Failed to create comment.');
    } finally {
      setSubmittingComment(false);
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
            <div className="flex items-center gap-4">
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
                  {post.game ? (
                    <span className="rounded-lg bg-zinc-100 px-2 py-0.5 text-[10px] font-black uppercase text-zinc-500">
                      {post.game}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs font-bold text-zinc-400">
                  @{post.authorHandle} · {formatRelativeTime(post.createdAt)}
                </p>
              </div>
            </div>
            <button className="rounded-2xl p-3 text-zinc-300 transition-all hover:bg-zinc-50 hover:text-black">
              <MoreHorizontal size={24} />
            </button>
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

          {post.externalLink ? (
            <a
              href={post.externalLink.url}
              target="_blank"
              rel="noreferrer"
              className="mb-8 block overflow-hidden rounded-[24px] border border-zinc-100 bg-zinc-50"
            >
              {post.externalLink.thumbnailUrl ? (
                <div className="relative h-64 w-full">
                  <Image
                    src={post.externalLink.thumbnailUrl}
                    alt={post.externalLink.title}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
              ) : null}
              <div className="space-y-1 p-5">
                <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">{post.externalLink.host}</p>
                <h3 className="text-lg font-black text-black">{post.externalLink.title}</h3>
                <p className="text-sm font-medium text-zinc-600">{post.externalLink.description}</p>
              </div>
            </a>
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
              <div className="flex items-center gap-2 text-sm font-black text-zinc-400">
                <Share2 size={22} />
                <span>{post.shares}</span>
              </div>
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

          <div className="mt-10 space-y-8">
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
              {submittedComments.length === 0 ? (
                <p className="text-sm font-bold text-zinc-400">
                  Existing comment listing is not provided by this API yet. New comments you add will appear here.
                </p>
              ) : (
                submittedComments.map((comment) => (
                  <div key={comment.commentId} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-sm font-black text-black">{comment.author}</span>
                      <span className="text-xs font-bold text-zinc-400">
                        @{comment.authorHandle} · {formatRelativeTime(comment.createdAt)}
                      </span>
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
