'use client';

import { getAuthGeneration, isCurrentAuthGeneration } from '@/lib/auth-store';
import { useAuth } from '@/app/context/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { Check, Copy, Loader2, Search, Send, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PostRecord, getInitials, getPostHref, sharePost } from '@/lib/feed-api';
import { searchMessageRecipients, sharePostMessage } from '@/lib/message-api';
import { MessageRecipient } from '@/lib/message-store';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface SharePostModalProps {
  post: PostRecord;
  onClose: () => void;
  onShared?: (result: Pick<PostRecord, 'postId' | 'shares'>) => void;
}

function buildPostUrl(postNumber: number) {
  const href = getPostHref(postNumber);
  return typeof window === 'undefined' ? href : `${window.location.origin}${href}`;
}

export function SharePostModal({ post, onClose, onShared }: SharePostModalProps) {
  useEscapeKey(onClose);
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [recipients, setRecipients] = useState<MessageRecipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [recipientError, setRecipientError] = useState('');

  useEffect(() => {
    if (!user?.id) { setLoading(false); setRecipients([]); return; }
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setRecipientError('');
        const next = await searchMessageRecipients(query, 20);
        if (!cancelled) {
          setRecipients(next);
        }
      } catch (error) {
        if (!cancelled) {
          setRecipientError(error instanceof Error ? error.message : '수신자 검색에 실패했습니다.');
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
  }, [query, user?.id]);

  const selectedRecipients = useMemo(
    () => recipients.filter((recipient) => selectedIds.includes(recipient.id)),
    [recipients, selectedIds]
  );
  const canSend = Boolean(user) && selectedIds.length > 0 && !sending && !sent;

  const updateShareCount = (shares: number) => {
    onShared?.({
      postId: post.postId,
      shares,
    });
  };

  const handleCopyLink = async () => {
    if (sending) return;
    const generation = getAuthGeneration();
    setSending(true);
    setErrorMessage('');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(buildPostUrl(post.postNumber));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setErrorMessage('링크를 자동으로 복사하지 못했습니다. 주소를 선택해서 직접 복사해 주세요.');
    }
    try {
      // 회원의 공유 의도 기록은 클립보드 권한과 무관하다.
      if (user && isCurrentAuthGeneration(generation)) {
        const response = await sharePost(post.postId, 'COPY_LINK');
        updateShareCount(response.shares);
      }
    } catch {
      setErrorMessage((previous) => previous || '공유 수를 갱신하지 못했습니다.');
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
    if (!requireAuth('메시지로 보내려면 로그인이 필요해요.')) return;
    if (!canSend) return;
    const generation = getAuthGeneration();

    try {
      setSending(true);
      setErrorMessage('');

      await sharePostMessage({
        post,
        recipientIds: selectedIds,
        content: message,
      });
      if (!isCurrentAuthGeneration(generation)) return;
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

  if (!user) {
    return (
      <div className="modal-overlay z-50">
        <section role="dialog" aria-modal="true" aria-labelledby="guest-share-title" className="modal-panel overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:max-w-[480px] lg:p-6">
          <div aria-hidden="true" className="modal-handle !mt-0 mb-4" />
          <div className="flex items-center justify-between">
            <h2 id="guest-share-title" className="text-title">게시글 공유</h2>
            <button type="button" className="btn-icon" aria-label="공유 닫기" onClick={onClose}><X size={20} /></button>
          </div>
          <input readOnly aria-label="게시글 링크" value={buildPostUrl(post.postNumber)} className="input-base my-4" />
          <button type="button" className="btn-primary w-full" disabled={sending} onClick={() => void handleCopyLink()}>{copied ? '복사 완료' : '링크 복사'}</button>
          {errorMessage ? <p role="alert" className="mt-3 text-label text-fg-danger">{errorMessage}</p> : null}
          <button type="button" className="btn-secondary mt-3 w-full" onClick={() => requireAuth('메시지로 보내려면 로그인이 필요해요.')}>메시지로 보내기</button>
        </section>
      </div>
    );
  }

  return (
    <div className="modal-overlay z-50">
      <div role="dialog" aria-modal="true" aria-labelledby="share-post-title" className="modal-panel flex flex-col overflow-hidden lg:max-w-[480px]">
        <div aria-hidden="true" className="modal-handle" />
        <div className="flex items-start justify-between gap-2 px-5 pt-4 lg:px-6 lg:pt-6">
          <div>
            <h2 id="share-post-title" className="text-title text-fg-primary">게시글 공유</h2>
            <p className="mt-1 text-body text-fg-secondary">링크를 복사하거나 메시지로 보낼 사람을 선택하세요</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon shrink-0"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 lg:px-6">
          <div className="rounded-control bg-subtle p-3">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-label text-fg-secondary">
                {getInitials(post.author)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-label text-fg-primary">{post.author}</p>
                <p className="truncate text-caption text-fg-tertiary">@{post.authorHandle}</p>
              </div>
            </div>
            <p className="line-clamp-2 text-body text-fg-secondary">
              {post.content || '미디어 게시글'}
            </p>
          </div>

          <div className="flex gap-2">
            <input readOnly aria-label="게시글 링크" value={buildPostUrl(post.postNumber)} className="input-base min-w-0 flex-1" />
            <button
              type="button"
              onClick={() => void handleCopyLink()}
              disabled={sending}
              className="btn-secondary h-11"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? '복사됨' : '링크 복사'}
            </button>
          </div>

          <div className="relative">
            <Search aria-hidden="true" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-icon-secondary" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="이름 또는 핸들 검색"
              aria-label="이름 또는 핸들 검색"
              className="input-base pl-10"
            />
          </div>

          <div className="space-y-2">
            {loading ? (
              <div role="status" className="flex items-center justify-center py-6 text-label text-fg-secondary">
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
                    aria-pressed={selected}
                    disabled={sending || sent}
                    className={`flex w-full items-center justify-between gap-3 rounded-control p-2 text-left text-fg-primary transition disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-line-focus ${
                      selected ? 'bg-brand-subtle' : 'hover:bg-subtle'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-subtle text-caption text-fg-secondary"
                      >
                        {getInitials(recipient.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-body">{recipient.name}</span>
                        <span
                          className="block truncate text-caption text-fg-tertiary"
                        >
                          {recipient.handle}
                        </span>
                      </span>
                    </span>
                    <span aria-hidden="true" className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border ${selected ? 'border-brand bg-brand text-fg-on-brand' : 'border-line-strong'}`}>
                      {selected ? <Check size={14} strokeWidth={3} /> : null}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="rounded-control bg-subtle px-4 py-5 text-center text-label text-fg-secondary">
                검색 결과가 없습니다.
              </div>
            )}
          </div>

          {selectedRecipients.length > 0 ? (
            <div className="text-caption text-fg-secondary">
              {selectedRecipients.map((recipient) => recipient.name).join(', ')}에게 공유합니다.
            </div>
          ) : null}

          {errorMessage || recipientError ? (
            <div role="alert" className="rounded-control bg-danger-subtle px-4 py-3 text-label text-fg-danger">
              {errorMessage || recipientError}
            </div>
          ) : null}
        </div>

        <div className="flex items-end gap-2 px-5 pt-1 pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:px-6 lg:pb-6">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="메시지 추가..."
            aria-label="공유 메시지"
            rows={1}
            disabled={sending || sent}
            className="input-base min-h-10 min-w-0 flex-1 resize-y py-2"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!canSend}
            className="btn-primary"
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
