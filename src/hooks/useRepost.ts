'use client';

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
  const [repostState, setRepostState] = useState(() => ({
    isReposted: post.isReposted,
    repostCount: post.repostCount,
  }));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestInFlightRef = useRef(false);

  useEffect(() => {
    setRepostState({
      isReposted: post.isReposted,
      repostCount: post.repostCount,
    });
  }, [post.isReposted, post.repostCount]);

  const toggleRepost = useCallback(async () => {
    if (requestInFlightRef.current) {
      return;
    }

    requestInFlightRef.current = true;
    const currentPost = { ...post, ...repostState };
    const optimisticPost = updatePostRepostState(currentPost);

    setIsLoading(true);
    setError(null);
    setRepostState({
      isReposted: optimisticPost.isReposted,
      repostCount: optimisticPost.repostCount,
    });
    onChange?.(optimisticPost);

    try {
      if (optimisticPost.isReposted) {
        await repostPost(post.postId);
      } else {
        await unrepostPost(post.postId);
      }
    } catch (repostError) {
      setRepostState({
        isReposted: currentPost.isReposted,
        repostCount: currentPost.repostCount,
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
  }, [onChange, post, repostState]);

  return {
    ...repostState,
    isLoading,
    error,
    toggleRepost,
  };
}
