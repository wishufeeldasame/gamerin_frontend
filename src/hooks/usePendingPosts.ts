'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, toUploadErrorMessage } from '@/lib/api-client';
import {
  type MultipartPostResult,
  type PostRecord,
  type PostVideoJob,
  createJsonPost,
  createMultipartPost,
  fetchPostVideoJob,
} from '@/lib/feed-api';
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
// 영상은 파일 전송(sending)이 끝나도 서버 처리(processing)가 끝날 때까지 "업로드 중"으로 남는다.
export type PendingPost = {
  id: string;
  draft: PostDraft;
  previews: PendingPostPreview[];
  status: 'uploading' | 'failed';
  phase: 'sending' | 'processing';
  errorMessage: string | null;
};

type PendingPostsOptions = {
  // 영상 게시물의 서버 처리가 끝났을 때 한 번 호출된다(완료 알림용).
  onVideoProcessed?: (post: PostRecord | null) => void;
};

export const VIDEO_JOB_POLL_INTERVAL_MS = 3000;
const VIDEO_PROCESSING_FAILED_MESSAGE = '동영상을 처리하지 못했습니다. 다시 시도해주세요.';

function createPendingId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `pending-${crypto.randomUUID()}`;
  }

  return `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function sendPostDraft(draft: PostDraft): Promise<MultipartPostResult> {
  if (draft.imageFiles.length === 0 && !draft.videoFile) {
    return { kind: 'post', post: await createJsonPost({ content: draft.content, externalLinkUrl: draft.externalLinkUrl }) };
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

// 네트워크 오류·응답 본문 수신 실패·서버 일시 오류·요청 제한은 처리 상태 확인을 잠시 뒤 다시 시도한다.
// 실패로 표시하면 사용자가 재시도할 때 새로 업로드해 같은 영상이 두 번 게시될 수 있다.
function isTransientPollError(error: unknown) {
  return error instanceof ApiError && (
    error.status === 0 || error.status === 429 || error.status >= 500 || error.reason === 'invalid-response'
  );
}

function revokePreviews(previews: PendingPostPreview[]) {
  previews.forEach((preview) => URL.revokeObjectURL(preview.url));
}

export function usePendingPosts(onCreated: (post: PostRecord) => void, options: PendingPostsOptions = {}) {
  const [pendingPosts, setPendingPosts] = useState<PendingPost[]>([]);
  // 언마운트·응답 처리 시점에 렌더와 무관하게 최신 목록을 읽기 위해 state와 함께 갱신한다.
  const pendingRef = useRef<PendingPost[]>([]);
  const disposedRef = useRef(false);
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;
  const onVideoProcessedRef = useRef(options.onVideoProcessed);
  onVideoProcessedRef.current = options.onVideoProcessed;

  const updatePendingPosts = useCallback((updater: (items: PendingPost[]) => PendingPost[]) => {
    pendingRef.current = updater(pendingRef.current);
    setPendingPosts(pendingRef.current);
  }, []);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      pendingRef.current.forEach((item) => revokePreviews(item.previews));
      pendingRef.current = [];
    };
  }, []);

  // 서버 처리 중에는 창을 닫아도 서버에서 계속 처리되므로 파일을 보내는 동안만 경고한다.
  useUnloadWarning(pendingPosts.some((item) => item.status === 'uploading' && item.phase === 'sending'));

  const isActive = useCallback(
    (pendingId: string) => !disposedRef.current && pendingRef.current.some((item) => item.id === pendingId),
    []
  );

  const waitForVideoJob = useCallback(async (pendingId: string, initialJob: PostVideoJob) => {
    let job = initialJob;
    while (job.status === 'QUEUED' || job.status === 'PROCESSING') {
      await new Promise((resolve) => setTimeout(resolve, VIDEO_JOB_POLL_INTERVAL_MS));
      if (!isActive(pendingId)) return undefined;
      try {
        job = await fetchPostVideoJob(job.jobId);
      } catch (error) {
        if (isTransientPollError(error)) continue;
        throw error;
      }
    }

    if (job.status === 'FAILED') {
      throw new Error(job.errorMessage || VIDEO_PROCESSING_FAILED_MESSAGE);
    }
    return job.post;
  }, [isActive]);

  const upload = useCallback(async (pendingId: string, draft: PostDraft) => {
    try {
      const result = await sendPostDraft(draft);
      // 언마운트·삭제로 이미 정리됐으면 결과를 반영할 화면이 없다.
      if (!isActive(pendingId)) return;

      let createdPost: PostRecord | null;
      if (result.kind === 'post') {
        createdPost = result.post;
      } else {
        updatePendingPosts((items) =>
          items.map((item) => (item.id === pendingId ? { ...item, phase: 'processing' } : item))
        );
        const processedPost = await waitForVideoJob(pendingId, result.job);
        if (processedPost === undefined || !isActive(pendingId)) return;
        createdPost = processedPost;
      }

      const target = pendingRef.current.find((item) => item.id === pendingId);
      if (target) revokePreviews(target.previews);
      updatePendingPosts((items) => items.filter((item) => item.id !== pendingId));
      // 처리 완료 뒤 게시물이 숨김·삭제됐으면 피드에 넣을 게시물이 없다.
      if (createdPost) onCreatedRef.current(createdPost);
      if (result.kind === 'videoJob') onVideoProcessedRef.current?.(createdPost);
    } catch (error) {
      if (!isActive(pendingId)) return;
      updatePendingPosts((items) =>
        items.map((item) =>
          item.id === pendingId
            ? { ...item, status: 'failed', errorMessage: toUploadErrorMessage(error, '게시글 작성에 실패했습니다.') }
            : item
        )
      );
    }
  }, [isActive, updatePendingPosts, waitForVideoJob]);

  const submit = useCallback((draft: PostDraft) => {
    const pendingPost: PendingPost = {
      id: createPendingId(),
      draft,
      previews: [
        ...draft.imageFiles.map((file) => ({ type: 'image' as const, url: URL.createObjectURL(file) })),
        ...(draft.videoFile ? [{ type: 'video' as const, url: URL.createObjectURL(draft.videoFile) }] : []),
      ],
      status: 'uploading',
      phase: 'sending',
      errorMessage: null,
    };

    updatePendingPosts((items) => [pendingPost, ...items]);
    void upload(pendingPost.id, draft);
  }, [updatePendingPosts, upload]);

  const retry = useCallback((pendingId: string) => {
    const target = pendingRef.current.find((item) => item.id === pendingId);
    if (!target || target.status !== 'failed') return;

    updatePendingPosts((items) =>
      items.map((item) =>
        item.id === pendingId ? { ...item, status: 'uploading', phase: 'sending', errorMessage: null } : item
      )
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
