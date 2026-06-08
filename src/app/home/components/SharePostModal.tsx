'use client';

import { Check, Copy, Loader2, Search, Send, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PostRecord, getInitials, sharePost } from '@/lib/feed-api';
import { searchMessageRecipients, sharePostMessage } from '@/lib/message-api';
import { MessageRecipient } from '@/lib/message-store';

interface SharePostModalProps {
  post: PostRecord;
  onClose: () => void;
  onShared?: (post: PostRecord) => void;
}

function buildPostUrl(postId: string) {
  if (typeof window === 'undefined') {
    return `/posts/${postId}`;
  }

  return `${window.location.origin}/posts/${postId}`;
}

export function SharePostModal({ post, onClose, onShared }: SharePostModalProps) {
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [recipients, setRecipients] = useState<MessageRecipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setErrorMessage('');
        const next = await searchMessageRecipients(query, 20);
        if (!cancelled) {
          setRecipients(next);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : '수신자 검색에 실패했습니다.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const selectedRecipients = useMemo(
    () => recipients.filter((recipient) => selectedIds.includes(recipient.id)),
    [recipients, selectedIds]
  );
  const canSend = selectedIds.length > 0 && !sending && !sent;

  const updateShareCount = (shares: number) => {
    onShared?.({
      ...post,
      shares,
    });
  };

  const handleCopyLink = async () => {
    if (sending) return;

    try {
      setSending(true);
      setErrorMessage('');
      const response = await sharePost(post.postId, 'COPY_LINK');

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(buildPostUrl(post.postId)).catch(() => undefined);
      }

      setCopied(true);
      updateShareCount(response.shares);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '게시글 링크 복사에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  const toggleRecipient = (recipientId: string) => {
    setSelectedIds((current) =>
      current.includes(recipientId)
        ? current.filter((id) => id !== recipientId)
        : [...current, recipientId]
    );
  };

  const handleSend = async () => {
    if (!canSend) return;

    try {
      setSending(true);
      setErrorMessage('');

      await sharePostMessage({
        post,
        recipientIds: selectedIds,
        content: message,
      });
      const response = await sharePost(post.postId, 'OTHER');

      setSent(true);
      updateShareCount(response.shares);
      window.setTimeout(onClose, 900);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '게시글 공유에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-black text-black">게시글 공유</h2>
            <p className="text-sm font-bold text-zinc-400">링크를 복사하거나 메시지로 보낼 사람을 선택하세요</p>
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
            <p className="line-clamp-2 text-sm font-medium leading-6 text-zinc-700">
              {post.content || '미디어 게시글'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleCopyLink()}
            disabled={sending}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black text-black transition hover:border-black disabled:cursor-not-allowed disabled:text-zinc-300"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? '복사됨' : '링크 복사'}
          </button>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="이름 또는 핸들 검색"
              className="h-12 w-full rounded-2xl border border-zinc-100 bg-zinc-50 pl-11 pr-4 text-sm font-bold text-black outline-none transition focus:border-black"
            />
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-sm font-bold text-zinc-400">
                <Loader2 size={16} className="mr-2 animate-spin" />
                검색 중...
              </div>
            ) : recipients.length > 0 ? (
              recipients.map((recipient) => {
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
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                          selected ? 'bg-white text-black' : 'bg-black text-white'
                        }`}
                      >
                        {getInitials(recipient.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black">{recipient.name}</span>
                        <span
                          className={`block truncate text-xs font-bold ${
                            selected ? 'text-white/70' : 'text-zinc-400'
                          }`}
                        >
                          {recipient.handle} · {recipient.role}
                        </span>
                      </span>
                    </span>
                    {selected ? <Check size={18} /> : null}
                  </button>
                );
              })
            ) : (
              <div className="rounded-2xl bg-zinc-50 px-4 py-5 text-center text-sm font-bold text-zinc-400">
                검색 결과가 없습니다.
              </div>
            )}
          </div>

          {selectedRecipients.length > 0 ? (
            <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-bold text-zinc-500">
              {selectedRecipients.map((recipient) => recipient.name).join(', ')} 에게 공유합니다.
            </div>
          ) : null}

          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="메시지 추가..."
            rows={3}
            className="w-full resize-none rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm font-medium text-black outline-none transition focus:border-black"
          />

          {errorMessage ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
              {errorMessage}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!canSend}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-black text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {sent ? (
              <>
                <Check size={18} />
                전송 완료
              </>
            ) : sending ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                전송 중...
              </>
            ) : (
              <>
                <Send size={18} />
                보내기
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
