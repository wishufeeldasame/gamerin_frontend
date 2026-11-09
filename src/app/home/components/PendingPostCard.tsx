'use client';

import Image from 'next/image';
import { CircleAlert, Loader2, RotateCw, Trash2 } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { getInitials } from '@/lib/feed-api';
import { UPLOAD_PHASE_LABELS } from '@/lib/upload-jobs';
import type { PendingPost } from '@/hooks/usePendingPosts';

interface PendingPostCardProps {
  pendingPost: PendingPost;
  onRetry: (pendingId: string) => void;
  onDiscard: (pendingId: string) => void;
}

// 서버 id가 없는 임시 게시물이라 좋아요·리포스트·북마크·공유·상세 이동 버튼을 두지 않는다.
export function PendingPostCard({ pendingPost, onRetry, onDiscard }: PendingPostCardProps) {
  const { user } = useAuth();
  const failed = pendingPost.status !== 'uploading';
  const uncertain = pendingPost.status === 'unavailable' || pendingPost.status === 'missing';
  const author = user?.nickname ?? '';

  return (
    <article
      aria-busy={!failed}
      aria-label={failed ? (uncertain ? '상태 확인이 필요한 게시글' : '업로드 실패한 게시글') : '업로드 중인 게시글'}
      className={`overflow-hidden rounded-card border bg-surface ${failed ? 'border-line-danger' : 'border-line-card'}`}
    >
      <div className="px-4 pb-3 pt-4 md:px-5 md:pt-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-subtle text-label text-fg-secondary">
            {user?.profileImageUrl ? (
              <Image src={user.profileImageUrl} alt={author} fill unoptimized sizes="40px" className="object-cover" />
            ) : (
              getInitials(author, 'G')
            )}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-body font-medium text-fg-primary">{author}</h2>
            {failed ? (
              <p role="alert" className="flex items-center gap-1 text-caption text-fg-danger">
                <CircleAlert size={12} className="shrink-0" />
                {pendingPost.status === 'rejected' ? '검열 거부 · ' : ''}{pendingPost.errorMessage}
              </p>
            ) : (
              <p role="status" className="flex items-center gap-1 text-caption text-fg-tertiary">
                <Loader2 size={12} className="animate-spin" />
                {UPLOAD_PHASE_LABELS[pendingPost.phase]}
              </p>
            )}
          </div>
        </div>

        {pendingPost.draft.content ? (
          <p className="whitespace-pre-wrap break-words text-body text-fg-primary">
            {pendingPost.draft.content}
          </p>
        ) : null}
      </div>

      {pendingPost.previews.length > 0 ? (
        <div className={`grid gap-1.5 px-4 pb-3 md:px-5 ${pendingPost.previews.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} ${failed ? '' : 'opacity-70'}`}>
          {pendingPost.previews.map((preview) =>
            preview.type === 'video' ? (
              <video key={preview.url} src={preview.url} muted controls playsInline className="aspect-video w-full rounded-control bg-black object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={preview.url} src={preview.url} alt="" className="aspect-square w-full rounded-control object-cover" />
            )
          )}
        </div>
      ) : null}

      {failed ? (
        <div className="flex justify-end gap-2 px-4 pb-4 md:px-5">
          {pendingPost.status !== 'rejected' && pendingPost.status !== 'invalid' && (uncertain || pendingPost.hasOriginal) ? <button
            type="button"
            onClick={() => onRetry(pendingPost.id)}
            className="btn-secondary h-8 px-3"
          >
            <RotateCw size={14} />
            {uncertain ? '상태 다시 확인' : '재시도'}
          </button> : <p className="text-caption text-fg-secondary">{pendingPost.status === 'rejected' || pendingPost.status === 'invalid' ? '내용·파일을 수정해 새로 작성해 주세요.' : '다시 작성하려면 파일을 선택해 주세요.'}</p>}
          <button
            type="button"
            onClick={() => onDiscard(pendingPost.id)}
            className="btn-secondary h-8 px-3 text-fg-danger"
          >
            <Trash2 size={14} />
            {uncertain ? '추적 닫기' : '삭제'}
          </button>
        </div>
      ) : null}
    </article>
  );
}
