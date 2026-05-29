'use client';

import { Check, Copy, Send, X } from 'lucide-react';
import { useState } from 'react';
import { PostRecord, ShareTarget, getInitials, sharePost } from '@/lib/feed-api';

interface SharePostModalProps {
  post: PostRecord;
  onClose: () => void;
  onShared?: (post: PostRecord) => void;
}

const shareOptions: { target: ShareTarget; label: string; description: string }[] = [
  { target: 'COPY_LINK', label: 'Copy link', description: 'Record a link copy share.' },
  { target: 'WEB_SHARE', label: 'Web share', description: 'Record a browser share action.' },
  { target: 'OTHER', label: 'Other', description: 'Record another share action.' },
];

function buildPostUrl(postId: string) {
  if (typeof window === 'undefined') {
    return `/home?post=${postId}`;
  }

  return `${window.location.origin}/home?post=${postId}`;
}

export function SharePostModal({ post, onClose, onShared }: SharePostModalProps) {
  const [selectedTarget, setSelectedTarget] = useState<ShareTarget>('COPY_LINK');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleShare = async () => {
    if (submitting || sent) {
      return;
    }

    try {
      setSubmitting(true);
      const response = await sharePost(post.postId, selectedTarget);

      if (selectedTarget === 'COPY_LINK' && navigator.clipboard) {
        await navigator.clipboard.writeText(buildPostUrl(post.postId)).catch(() => undefined);
      }

      setSent(true);
      onShared?.({
        ...post,
        shares: response.shares,
      });

      window.setTimeout(onClose, 700);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to share post.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-black text-black">Share post</h2>
            <p className="text-sm font-bold text-zinc-400">Choose how this share should be recorded.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-black"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black text-xs font-black text-white">
                {getInitials(post.author)}
              </div>
              <div className="min-w-0">
                <p className="font-black text-black">{post.author}</p>
                <p className="text-xs font-bold text-zinc-400">@{post.authorHandle}</p>
              </div>
            </div>
            <p className="line-clamp-2 text-sm font-medium leading-6 text-zinc-700">
              {post.content || 'Media post'}
            </p>
          </div>

          <div className="space-y-2">
            {shareOptions.map((option) => {
              const selected = selectedTarget === option.target;

              return (
                <button
                  key={option.target}
                  type="button"
                  onClick={() => setSelectedTarget(option.target)}
                  className={`flex w-full items-center justify-between rounded-2xl p-4 text-left transition ${
                    selected ? 'bg-black text-white' : 'bg-zinc-50 text-black hover:bg-zinc-100'
                  }`}
                >
                  <span>
                    <span className="block text-sm font-black">{option.label}</span>
                    <span className={`block text-xs font-bold ${selected ? 'text-white/70' : 'text-zinc-400'}`}>
                      {option.description}
                    </span>
                  </span>
                  {option.target === 'COPY_LINK' ? <Copy size={18} /> : selected ? <Check size={18} /> : null}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleShare}
            disabled={submitting || sent}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-black text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {sent ? (
              <>
                <Check size={18} />
                Shared
              </>
            ) : (
              <>
                <Send size={18} />
                {submitting ? 'Sharing...' : 'Share'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
