'use client';

import { Check, Copy, Search, Send, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { PostRecord, getInitials, sharePost } from '@/lib/feed-api';
import { sharePostMessage } from '@/lib/message-api';
import { MESSAGE_RECIPIENTS, MessageRecipient } from '@/lib/message-store';

interface SharePostModalProps {
  post: PostRecord;
  onClose: () => void;
  onShared?: (post: PostRecord) => void;
}

function buildPostUrl(postId: string) {
  if (typeof window === 'undefined') {
    return `/home?postId=${postId}`;
  }

  return `${window.location.origin}/home?postId=${postId}`;
}

export function SharePostModal({ post, onClose, onShared }: SharePostModalProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const filteredRecipients = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return MESSAGE_RECIPIENTS;

    return MESSAGE_RECIPIENTS.filter((recipient) =>
      [recipient.name, recipient.handle, recipient.role].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [query]);

  const selectedRecipients: MessageRecipient[] = MESSAGE_RECIPIENTS.filter((recipient) =>
    selectedIds.includes(recipient.id)
  );
  const canSend = selectedRecipients.length > 0 && !submitting && !sent;

  const updateShareCount = (shares: number) => {
    onShared?.({
      ...post,
      shares,
    });
  };

  const handleCopyLink = async () => {
    if (submitting) return;

    try {
      setSubmitting(true);
      const response = await sharePost(post.postId, 'COPY_LINK');

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(buildPostUrl(post.postId)).catch(() => undefined);
      }

      setCopied(true);
      updateShareCount(response.shares);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      alert(error instanceof Error ? error.message : '게시글 링크 복사에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSend = async () => {
    if (!canSend) return;

    try {
      setSubmitting(true);
      await sharePostMessage(user?.id, post, selectedRecipients, message.trim());
      const response = await sharePost(post.postId, 'OTHER');

      setSent(true);
      updateShareCount(response.shares);
      window.setTimeout(onClose, 900);
    } catch (error) {
      alert(error instanceof Error ? error.message : '게시글 공유에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleRecipient = (recipientId: string) => {
    setSelectedIds((current) =>
      current.includes(recipientId) ? current.filter((id) => id !== recipientId) : [...current, recipientId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-black text-black">게시글 공유</h2>
            <p className="text-sm font-bold text-zinc-400">링크를 복사하거나 친구에게 보내세요.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-black"
            aria-label="닫기"
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
            <p className="line-clamp-2 text-sm font-medium leading-6 text-zinc-700">{post.content || '미디어 게시글'}</p>
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black text-black transition hover:border-black disabled:cursor-not-allowed disabled:text-zinc-300"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? '복사됨' : '링크 복사'}
          </button>

          <div className="space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="친구 검색"
                className="h-11 w-full rounded-2xl border border-zinc-100 bg-zinc-50 pl-10 pr-4 text-sm font-medium text-black outline-none focus:border-black"
              />
            </div>

            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {filteredRecipients.map((recipient) => {
                const selected = selectedIds.includes(recipient.id);

                return (
                  <button
                    key={recipient.id}
                    type="button"
                    onClick={() => toggleRecipient(recipient.id)}
                    className={`flex w-full items-center justify-between rounded-2xl p-3 text-left transition ${
                      selected ? 'bg-black text-white' : 'bg-zinc-50 text-black hover:bg-zinc-100'
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-black">{recipient.name}</span>
                      <span className={`block text-xs font-bold ${selected ? 'text-white/70' : 'text-zinc-400'}`}>
                        {recipient.handle} · {recipient.role}
                      </span>
                    </span>
                    {selected ? <Check size={18} /> : null}
                  </button>
                );
              })}
            </div>

            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="메시지 추가"
              className="min-h-20 w-full resize-none rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm font-medium text-black outline-none focus:border-black"
            />
          </div>

          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-black text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {sent ? (
              <>
                <Check size={18} />
                전송됨
              </>
            ) : (
              <>
                <Send size={18} />
                {submitting ? '전송 중...' : '보내기'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
