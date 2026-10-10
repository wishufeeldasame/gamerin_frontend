'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/app/context/ToastContext';
import { likePost, unlikePost, type PostRecord } from '@/lib/feed-api';

type LikeTarget = Pick<PostRecord, 'postId' | 'likedByMe'>;

export type ApplyLikeState = (postId: string, likedByMe: boolean) => void;

export function usePostLike(applyLikeState: ApplyLikeState) {
  const toast = useToast();
  const inFlightPostIdsRef = useRef(new Set<string>());
  const mountedRef = useRef(true);
  const [likeLoadingByPostId, setLikeLoadingByPostId] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const inFlightPostIds = inFlightPostIdsRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      inFlightPostIds.clear();
    };
  }, []);

  const toggleLike = useCallback(async (post: LikeTarget) => {
    if (inFlightPostIdsRef.current.has(post.postId)) return;

    const previousLikedByMe = post.likedByMe;
    const nextLikedByMe = !previousLikedByMe;

    inFlightPostIdsRef.current.add(post.postId);
    setLikeLoadingByPostId((current) => ({ ...current, [post.postId]: true }));
    applyLikeState(post.postId, nextLikedByMe);

    try {
      if (nextLikedByMe) {
        await likePost(post.postId);
      } else {
        await unlikePost(post.postId);
      }
    } catch (error) {
      applyLikeState(post.postId, previousLikedByMe);
      toast.error(error instanceof Error ? error.message : '좋아요 상태를 변경하지 못했습니다.');
    } finally {
      inFlightPostIdsRef.current.delete(post.postId);
      if (mountedRef.current) {
        setLikeLoadingByPostId((current) => {
          const next = { ...current };
          delete next[post.postId];
          return next;
        });
      }
    }
  }, [applyLikeState, toast]);

  return {
    toggleLike,
    likeLoadingByPostId,
  };
}
