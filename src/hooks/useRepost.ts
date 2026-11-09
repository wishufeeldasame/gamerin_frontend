'use client';

import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuth } from '@/app/context/AuthContext';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type PostRecord,
  repostPost,
  unrepostPost,
  updatePostRepostState,
} from '@/lib/feed-api';

interface UseRepostOptions {
  onChange?: (post: PostRecord) => void;
}

export function useRepost(post: PostRecord, onChange?: UseRepostOptions['onChange']) {
  const requireAuth = useRequireAuth();
  const { user } = useAuth();
  const [repostState, setRepostState] = useState(() => ({
    isReposted: post.isReposted,
    repostCount: post.repostCount,
    reposterInfo: post.reposterInfo,
  }));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestInFlightRef = useRef(false);

  useEffect(() => {
    setRepostState({
      isReposted: post.isReposted,
      repostCount: post.repostCount,
      reposterInfo: post.reposterInfo,
    });
  }, [post.isReposted, post.repostCount, post.reposterInfo]);

  const toggleRepost = useCallback(async () => {
    if (!requireAuth('반응을 남기려면 로그인이 필요해요.')) return;
    if (requestInFlightRef.current) {
      return;
    }

    requestInFlightRef.current = true;
    const currentPost = { ...post, ...repostState };
    const optimisticPost = updatePostRepostState(currentPost);
    optimisticPost.reposterInfo = optimisticPost.isReposted && user ? {
      userId: user.id,
      nickname: user.nickname,
      membershipBadge: user.membershipBadge,
      representativeTier: user.representativeTier,
      repostedAt: new Date().toISOString(),
    } : currentPost.reposterInfo?.userId === user?.id ? null : currentPost.reposterInfo;

    setIsLoading(true);
    setError(null);
    setRepostState({
      isReposted: optimisticPost.isReposted,
      repostCount: optimisticPost.repostCount,
      reposterInfo: optimisticPost.reposterInfo,
    });
    onChange?.(optimisticPost);

    try {
      const response = optimisticPost.isReposted
        ? await repostPost(post.postId)
        : await unrepostPost(post.postId);
      const confirmedPost = {
        ...currentPost,
        isReposted: response.isReposted,
        repostCount: response.repostCount,
        reposterInfo: response.isReposted ? optimisticPost.reposterInfo && {
          ...optimisticPost.reposterInfo,
          repostedAt: response.repostedAt ?? optimisticPost.reposterInfo.repostedAt,
        } : optimisticPost.reposterInfo,
      };

      setRepostState({
        isReposted: confirmedPost.isReposted,
        repostCount: confirmedPost.repostCount,
        reposterInfo: confirmedPost.reposterInfo,
      });
      onChange?.(confirmedPost);
    } catch (repostError) {
      setRepostState({
        isReposted: currentPost.isReposted,
        repostCount: currentPost.repostCount,
        reposterInfo: currentPost.reposterInfo,
      });
      onChange?.(currentPost);
      setError(
        repostError instanceof Error
          ? repostError.message
          : '리포스트 상태를 변경하지 못했습니다.',
      );
    } finally {
      requestInFlightRef.current = false;
      setIsLoading(false);
    }
  }, [onChange, post, repostState, requireAuth, user]);

  return {
    ...repostState,
    isLoading,
    error,
    toggleRepost,
  };
}
