'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toUploadErrorMessage } from '@/lib/api-client';
import { type PostRecord, createJsonPost, createMultipartPost } from '@/lib/feed-api';
import { useUnloadWarning } from '@/hooks/useUnloadWarning';

export type PostDraft = {
  content: string;
  externalLinkUrl: string;
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
  status: 'uploading' | 'failed';
  errorMessage: string | null;
};

function createPendingId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `pending-${crypto.randomUUID()}`;
  }

  return `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sendPostDraft(draft: PostDraft) {
  if (draft.imageFiles.length === 0 && !draft.videoFile) {
    return createJsonPost({ content: draft.content, externalLinkUrl: draft.externalLinkUrl });
  }

  const formData = new FormData();
  if (draft.content) {
    formData.append('content', draft.content);
  }

  draft.imageFiles.forEach((file) => formData.append('mediaFiles', file));

  if (draft.videoFile) {
    formData.append('mediaFiles', draft.videoFile);
    if (draft.thumbnailFile) {
      formData.append('thumbnailFile', draft.thumbnailFile);
    }
  }

  return createMultipartPost(formData);
}

function revokePreviews(previews: PendingPostPreview[]) {
  previews.forEach((preview) => URL.revokeObjectURL(preview.url));
}

export function usePendingPosts(onCreated: (post: PostRecord) => void) {
  const [pendingPosts, setPendingPosts] = useState<PendingPost[]>([]);
  // 언마운트·응답 처리 시점에 렌더와 무관하게 최신 목록을 읽기 위해 state와 함께 갱신한다.
  const pendingRef = useRef<PendingPost[]>([]);
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;

  const updatePendingPosts = useCallback((updater: (items: PendingPost[]) => PendingPost[]) => {
    pendingRef.current = updater(pendingRef.current);
    setPendingPosts(pendingRef.current);
  }, []);

  useEffect(() => () => {
    pendingRef.current.forEach((item) => revokePreviews(item.previews));
    pendingRef.current = [];
  }, []);

  useUnloadWarning(pendingPosts.some((item) => item.status === 'uploading'));

  const upload = useCallback(async (pendingId: string, draft: PostDraft) => {
    try {
      const createdPost = await sendPostDraft(draft);
      const target = pendingRef.current.find((item) => item.id === pendingId);
      // 언마운트로 이미 정리됐으면 결과를 반영할 화면이 없다.
      if (!target) return;

      revokePreviews(target.previews);
      updatePendingPosts((items) => items.filter((item) => item.id !== pendingId));
      onCreatedRef.current(createdPost);
    } catch (error) {
      updatePendingPosts((items) =>
        items.map((item) =>
          item.id === pendingId
            ? { ...item, status: 'failed', errorMessage: toUploadErrorMessage(error, '게시글 작성에 실패했습니다.') }
            : item
        )
      );
    }
  }, [updatePendingPosts]);

  const submit = useCallback((draft: PostDraft) => {
    const pendingPost: PendingPost = {
      id: createPendingId(),
      draft,
      previews: [
        ...draft.imageFiles.map((file) => ({ type: 'image' as const, url: URL.createObjectURL(file) })),
        ...(draft.videoFile ? [{ type: 'video' as const, url: URL.createObjectURL(draft.videoFile) }] : []),
      ],
      status: 'uploading',
      errorMessage: null,
    };

    updatePendingPosts((items) => [pendingPost, ...items]);
    void upload(pendingPost.id, draft);
  }, [updatePendingPosts, upload]);

  const retry = useCallback((pendingId: string) => {
    const target = pendingRef.current.find((item) => item.id === pendingId);
    if (!target || target.status !== 'failed') return;

    updatePendingPosts((items) =>
      items.map((item) => (item.id === pendingId ? { ...item, status: 'uploading', errorMessage: null } : item))
    );
    void upload(pendingId, target.draft);
  }, [updatePendingPosts, upload]);

  const discard = useCallback((pendingId: string) => {
    const target = pendingRef.current.find((item) => item.id === pendingId);
    if (!target) return;

    revokePreviews(target.previews);
    updatePendingPosts((items) => items.filter((item) => item.id !== pendingId));
  }, [updatePendingPosts]);

  return { pendingPosts, submit, retry, discard };
}
