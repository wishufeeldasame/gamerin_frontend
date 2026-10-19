'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { updatePostContent, type PostRecord } from '@/lib/feed-api';
import { MAX_POST_CONTENT_LENGTH } from './PostComposer';

const MINUTE_MS = 60_000;

/** 수정 버튼을 보여줄지: 본인 게시물, 아직 수정하지 않음, 마감 전(서버가 다시 검사한다). */
export function canEditPost(post: PostRecord, now = Date.now()) {
  if (!post.mine || post.editCount !== 0 || !post.editableUntil) return false;
  const until = new Date(post.editableUntil).getTime();
  return Number.isFinite(until) && now < until;
}

/**
 * 메뉴의 `수정`을 눌렀을 때: 멤버십이 아니면 혜택 안내 후 멤버십 화면으로, 맞으면 편집기를 연다.
 * 배지 값은 로그인 시점 정보라 서버가 요청 시점 멤버십을 다시 검사한다.
 */
export async function requestPostEdit({
  hasMembership,
  confirm,
  goToMembership,
  openEditor,
  returnFocusTo,
}: {
  hasMembership: boolean;
  confirm: (options: { message: string; confirmLabel?: string; returnFocusTo?: HTMLElement | null }) => Promise<boolean>;
  goToMembership: () => void;
  openEditor: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  if (hasMembership) {
    openEditor();
    return;
  }
  const confirmed = await confirm({
    message: '게시물 수정은 멤버십 혜택이에요. 멤버십 화면으로 이동할까요?',
    confirmLabel: '멤버십 보기',
    returnFocusTo,
  });
  if (confirmed) goToMembership();
}

// 서버 거부 문구가 영어로 오는 경우가 있어 상태별 한국어 문구로 바꾼다. 한국어 문구(검열 등)는 그대로 쓴다.
function editErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/[가-힣]/.test(message)) return message;
  const status = (error as { status?: number }).status;
  if (status === 403) return '멤버십이 유효할 때만 본인 게시물을 수정할 수 있어요.';
  if (status === 409) return '수정 가능 시간이 지났거나 이미 수정한 게시물이에요.';
  if (status === 404) return '게시물을 찾을 수 없어요.';
  return '게시물을 수정하지 못했어요. 잠시 후 다시 시도해주세요.';
}

export function EditPostModal({
  post,
  onClose,
  onSaved,
}: {
  post: PostRecord;
  onClose: () => void;
  onSaved: (post: PostRecord) => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState(post.content ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const until = post.editableUntil ? new Date(post.editableUntil).getTime() : 0;
  const remainingMs = Math.max(0, until - now);
  const expired = remainingMs <= 0;
  const unchanged = content.trim() === (post.content ?? '').trim();

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (expired) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [expired]);

  const save = async () => {
    if (saving || expired || unchanged) return;
    setSaving(true);
    setError(null);
    try {
      onSaved(await updatePostContent(post.postId, content));
    } catch (caught) {
      setError(editErrorMessage(caught));
      setSaving(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (!saving) onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>('textarea, button:not([disabled])') ?? [])];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4"
      onMouseDown={saving ? undefined : onClose}
      data-card-open-ignore="true"
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-post-title"
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-zinc-100 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="edit-post-title" className="text-xl font-black text-black dark:text-zinc-100">게시물 수정</h2>
          <span className={`text-xs font-black ${expired ? 'text-red-500' : 'text-zinc-400'}`} aria-live="polite">
            {expired ? '수정 가능 시간이 지났어요' : `남은 시간 ${Math.ceil(remainingMs / MINUTE_MS)}분`}
          </span>
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={MAX_POST_CONTENT_LENGTH}
          disabled={saving}
          aria-label="게시물 본문"
          className="mt-4 min-h-40 w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-black outline-none transition focus:border-[#f5b93d] dark:focus:!border-[#f5b93d]"
        />
        <p className={`mt-1 text-right text-xs font-bold ${content.length >= MAX_POST_CONTENT_LENGTH ? 'text-red-500' : 'text-zinc-400'}`}>
          {content.length}/{MAX_POST_CONTENT_LENGTH}
        </p>
        <p className="mt-2 text-xs font-bold text-zinc-500">이미지·영상은 수정할 수 없어요. 게시물당 1회만 수정됩니다.</p>

        {error ? (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-600 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-12 rounded-xl border border-zinc-200 px-5 text-sm font-black text-black disabled:opacity-50 dark:border-neutral-700"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || expired || unchanged}
            className="h-12 rounded-xl bg-black px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 dark:bg-[#f5b93d] dark:text-black dark:disabled:bg-neutral-700 dark:disabled:text-zinc-400"
          >
            {saving ? '수정하는 중…' : '수정하기'}
          </button>
        </div>
      </section>
    </div>
  );
}
