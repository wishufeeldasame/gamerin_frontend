'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toUploadErrorMessage } from '@/lib/api-client';
import { getAuthGeneration, isCurrentAuthGeneration } from '@/lib/auth-store';
import { type PostRecord, createJsonPost, createPostUpload, fetchPostUploadJob } from '@/lib/feed-api';
import { createClientId } from '@/lib/message-store';
import { loadUploadRecords, removeUploadRecord, saveUploadRecord, trackUpload, UploadJobError,
  UPLOAD_POLL_INTERVAL_MS, type UploadPhase, type UploadRecord } from '@/lib/upload-jobs';
import { useUnloadWarning } from '@/hooks/useUnloadWarning';

export type PostDraft = {
  content: string;
  imageFiles: File[];
  videoFile: File | null;
  thumbnailFile: File | null;
};

export type PendingPostPreview = {
  type: 'image' | 'video';
  url: string;
};

// 서버 응답 전까지 작성자 화면에만 보이는 임시 게시물. 서버 id가 없으므로 상호작용은 제공하지 않는다.
export type PendingPost = {
  id: string;
  draft: PostDraft;
  previews: PendingPostPreview[];
  status: 'uploading' | 'failed' | 'rejected' | 'invalid' | 'unavailable' | 'missing';
  phase: UploadPhase;
  errorMessage: string | null;
  record?: UploadRecord;
  hasOriginal: boolean;
};

type PendingPostsOptions = {
  userId?: string;
  // 미디어 게시물의 서버 처리가 끝났을 때 한 번 호출된다(완료 알림용).
  onVideoProcessed?: (post: PostRecord | null) => void;
};

export const VIDEO_JOB_POLL_INTERVAL_MS = UPLOAD_POLL_INTERVAL_MS;

function toFormData(draft: PostDraft) {
  const formData = new FormData();
  if (draft.content) formData.append('content', draft.content);
  draft.imageFiles.forEach((file) => formData.append('mediaFiles', file));
  if (draft.videoFile) {
    formData.append('mediaFiles', draft.videoFile);
    if (draft.thumbnailFile) formData.append('thumbnailFile', draft.thumbnailFile);
  }
  return formData;
}

function revokePreviews(previews: PendingPostPreview[]) {
  previews.forEach((preview) => URL.revokeObjectURL(preview.url));
}

export function usePendingPosts(onCreated: (post: PostRecord) => void, options: PendingPostsOptions = {}) {
  const [pendingPosts, setPendingPosts] = useState<PendingPost[]>([]);
  // 언마운트·응답 처리 시점에 렌더와 무관하게 최신 목록을 읽기 위해 state와 함께 갱신한다.
  const pendingRef = useRef<PendingPost[]>([]);
  const sessionRef = useRef(0);
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;
  const onVideoProcessedRef = useRef(options.onVideoProcessed);
  onVideoProcessedRef.current = options.onVideoProcessed;

  const updatePendingPosts = useCallback((updater: (items: PendingPost[]) => PendingPost[]) => {
    pendingRef.current = updater(pendingRef.current);
    setPendingPosts(pendingRef.current);
  }, []);

  // 서버 처리 중에는 창을 닫아도 서버에서 계속 처리되므로 파일을 보내는 동안만 경고한다.
  useUnloadWarning(pendingPosts.some((item) => item.status === 'uploading' && item.phase === 'sending'));

  const upload = useCallback(async (target: PendingPost, recover = false) => {
    const session = sessionRef.current;
    const generation = getAuthGeneration();
    const active = () => sessionRef.current === session && isCurrentAuthGeneration(generation) &&
      pendingRef.current.some((item) => item.id === target.id);
    try {
      let post: PostRecord | null;
      if (target.record) {
        const job = await trackUpload(target.record, {
          recover,
          send: target.hasOriginal ? () => createPostUpload(toFormData(target.draft), target.id) : undefined,
          fetchJob: fetchPostUploadJob,
          active,
          onPhase: (phase) => updatePendingPosts((items) => items.map((item) => item.id === target.id ? { ...item, phase } : item)),
        });
        post = job.post;
      } else {
        post = await createJsonPost({ content: target.draft.content });
      }
      if (!active()) return;
      revokePreviews(target.previews);
      updatePendingPosts((items) => items.filter((item) => item.id !== target.id));
      // 처리 완료 뒤 게시물이 숨김·삭제됐으면 피드에 넣을 게시물이 없다.
      if (post) onCreatedRef.current(post);
      if (target.record) onVideoProcessedRef.current?.(post);
    } catch (error) {
      if (!active()) return;
      updatePendingPosts((items) => items.map((item) => item.id === target.id ? {
        ...item,
        status: error instanceof UploadJobError ? error.kind : target.record ? 'unavailable' : 'failed',
        errorMessage: toUploadErrorMessage(error, '게시글 작성에 실패했습니다.'),
      } : item));
    }
  }, [updatePendingPosts]);

  useEffect(() => {
    sessionRef.current += 1;
    const restored = options.userId ? loadUploadRecords(options.userId, 'post').map((record): PendingPost => ({
      id: record.clientId, record, hasOriginal: false,
      draft: { content: '', imageFiles: [], videoFile: null, thumbnailFile: null },
      previews: [], status: 'uploading', phase: 'processing', errorMessage: null,
    })) : [];
    updatePendingPosts(() => restored);
    restored.forEach((item) => void upload(item, true));
    return () => {
      sessionRef.current += 1;
      pendingRef.current.forEach((item) => revokePreviews(item.previews));
      pendingRef.current = [];
    };
  }, [options.userId, updatePendingPosts, upload]);

  const submit = useCallback((draft: PostDraft) => {
    const id = createClientId();
    const hasMedia = draft.imageFiles.length > 0 || !!draft.videoFile;
    const pendingPost: PendingPost = {
      id, draft, hasOriginal: true,
      ...(hasMedia ? { record: { userId: options.userId ?? '', kind: 'post' as const, clientId: id } } : {}),
      previews: [
        ...draft.imageFiles.map((file) => ({ type: 'image' as const, url: URL.createObjectURL(file) })),
        ...(draft.videoFile ? [{ type: 'video' as const, url: URL.createObjectURL(draft.videoFile) }] : []),
      ],
      status: 'uploading', phase: 'sending', errorMessage: null,
    };
    updatePendingPosts((items) => [pendingPost, ...items]);
    void upload(pendingPost);
  }, [options.userId, updatePendingPosts, upload]);

  const retry = useCallback((pendingId: string) => {
    const target = pendingRef.current.find((item) => item.id === pendingId);
    if (!target || target.status === 'uploading' || target.status === 'rejected' || target.status === 'invalid') return;
    if (target.status === 'failed' && !target.hasOriginal) return;
    let next = { ...target, status: 'uploading' as const, errorMessage: null };
    if (target.status === 'failed' && target.record) {
      removeUploadRecord(target.record);
      const id = createClientId();
      next = { ...next, id, record: { ...target.record, clientId: id, jobId: undefined }, phase: 'sending' };
      saveUploadRecord(next.record!);
    }
    updatePendingPosts((items) => items.map((item) => item.id === pendingId ? next : item));
    void upload(next, target.status !== 'failed');
  }, [updatePendingPosts, upload]);

  const discard = useCallback((pendingId: string) => {
    const target = pendingRef.current.find((item) => item.id === pendingId);
    if (!target) return;
    revokePreviews(target.previews);
    if (target.record) removeUploadRecord(target.record);
    updatePendingPosts((items) => items.filter((item) => item.id !== pendingId));
  }, [updatePendingPosts]);

  return { pendingPosts, submit, retry, discard };
}
