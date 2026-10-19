'use client';

import Image from 'next/image';
import { CircleAlert, Loader2, RotateCw, Trash2 } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { getInitials } from '@/lib/feed-api';
import type { PendingPost } from '@/hooks/usePendingPosts';

interface PendingPostCardProps {
  pendingPost: PendingPost;
  onRetry: (pendingId: string) => void;
  onDiscard: (pendingId: string) => void;
}

// 서버 id가 없는 임시 게시물이라 좋아요·리포스트·북마크·공유·상세 이동 버튼을 두지 않는다.
export function PendingPostCard({ pendingPost, onRetry, onDiscard }: PendingPostCardProps) {
  const { user } = useAuth();
  const failed = pendingPost.status === 'failed';
  const hasVideo = pendingPost.previews.some((preview) => preview.type === 'video');
  const author = user?.nickname ?? '';

  return (
    <article
      aria-busy={!failed}
      aria-label={failed ? '업로드 실패한 게시물' : '업로드 중인 게시물'}
      className={`overflow-hidden rounded-[32px] border bg-white shadow-sm ${
        failed ? 'border-red-200 dark:border-red-900' : 'border-zinc-100 dark:border-neutral-800'
      }`}
    >
      <div className="p-5">
        <div className="mb-4 flex items-center gap-4">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black text-sm font-black text-white shadow-inner">
            {user?.profileImageUrl ? (
              <Image src={user.profileImageUrl} alt={author} fill unoptimized sizes="48px" className="object-cover" />
            ) : (
              getInitials(author, 'G')
            )}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-black tracking-tight text-black">{author}</h2>
            {failed ? (
              <p role="alert" className="flex items-center gap-1 text-[11px] font-bold text-red-500 dark:text-red-300">
                <CircleAlert size={12} className="shrink-0" />
                {pendingPost.errorMessage}
              </p>
            ) : (
              <p role="status" className="flex items-center gap-1 text-[11px] font-bold text-zinc-400">
                <Loader2 size={12} className="animate-spin" />
                {hasVideo ? '동영상 업로드 중... 처리에 시간이 걸릴 수 있습니다' : '업로드 중...'}
              </p>
            )}
          </div>
        </div>

        {pendingPost.draft.content ? (
          <p className="whitespace-pre-wrap break-words px-1 text-[15px] font-medium leading-7 text-zinc-800">
            {pendingPost.draft.content}
          </p>
        ) : null}
        {pendingPost.draft.externalLinkUrl ? (
          <p className="mt-2 truncate px-1 text-sm font-bold text-zinc-500">{pendingPost.draft.externalLinkUrl}</p>
        ) : null}
      </div>

      {pendingPost.previews.length > 0 ? (
        <div className={`grid gap-1 ${pendingPost.previews.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} ${failed ? '' : 'opacity-70'}`}>
          {pendingPost.previews.map((preview) =>
            preview.type === 'video' ? (
              <video key={preview.url} src={preview.url} muted controls className="max-h-[420px] w-full bg-black object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={preview.url} src={preview.url} alt="" className="aspect-square w-full object-cover" />
            )
          )}
        </div>
      ) : null}

      {failed ? (
        <div className="flex justify-end gap-2 border-t border-zinc-50 px-6 py-3 dark:border-neutral-800">
          <button
            type="button"
            onClick={() => onRetry(pendingPost.id)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-600 transition hover:border-red-400 dark:border-red-900 dark:text-red-300"
          >
            <RotateCw size={14} />
            재시도
          </button>
          <button
            type="button"
            onClick={() => onDiscard(pendingPost.id)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-black text-zinc-500 transition hover:border-zinc-400 hover:text-black"
          >
            <Trash2 size={14} />
            삭제
          </button>
        </div>
      ) : null}
    </article>
  );
}
