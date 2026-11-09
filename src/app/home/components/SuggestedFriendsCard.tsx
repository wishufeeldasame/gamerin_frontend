'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { fetchUserRecommendations, followUser, getInitials, type UserRecommendation } from '@/lib/feed-api';
import { MembershipBadge } from './MembershipBadge';
import { RepresentativeTierBadge } from './RepresentativeTierBadge';

export function SuggestedFriendsCard() {
  const { user, isAuthReady, isLoggingOut, isAccountBlocked, isSessionUnavailable } = useAuth();
  if (!user || !isAuthReady || isLoggingOut || isAccountBlocked || isSessionUnavailable) return null;
  return <SuggestedFriendsList key={user.id} />;
}

function SuggestedFriendsList() {
  const requireAuth = useRequireAuth();
  const [friends, setFriends] = useState<UserRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followError, setFollowError] = useState<string | null>(null);
  const [pendingHandle, setPendingHandle] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const request = useRef<AbortController | null>(null);
  const following = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    void fetchUserRecommendations({ signal: controller.signal })
      .then((users) => {
        if (!controller.signal.aborted) setFriends(users);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('추천 친구를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);

  async function handleFollow(friend: UserRecommendation) {
    if (following.current || !requireAuth()) return;
    const signal = request.current?.signal;
    following.current = true;
    setPendingHandle(friend.handle);
    setFollowError(null);
    try {
      await followUser(friend.handle);
      if (!signal?.aborted) setFriends((users) => users.filter((user) => user.userId !== friend.userId));
    } catch {
      if (!signal?.aborted) setFollowError('팔로우하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      following.current = false;
      if (!signal?.aborted) setPendingHandle(null);
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-heading text-fg-primary">추천 친구</h2>
      </div>
      <div className="rounded-card border border-line-card bg-surface px-4">
        {loading ? (
          <p role="status" className="py-4 text-caption text-fg-secondary">추천 친구를 불러오는 중...</p>
        ) : error ? (
          <div className="py-4">
            <p role="alert" className="text-caption text-fg-secondary">{error}</p>
            <button type="button" className="btn-secondary mt-2 h-8 px-3" onClick={() => setRetry((value) => value + 1)}>다시 시도</button>
          </div>
        ) : friends.length === 0 ? (
          <p role="status" className="py-4 text-caption text-fg-secondary">아직 추천할 친구가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-line">
            {friends.map((friend) => (
              <li key={friend.userId} className="flex items-center gap-3 py-3">
                <Link href={`/profile/${encodeURIComponent(friend.handle)}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-subtle text-label text-fg-secondary">
                    {friend.profileImageUrl ? (
                      <Image src={friend.profileImageUrl} alt="" width={36} height={36} unoptimized className="size-9 object-cover" />
                    ) : getInitials(friend.nickname)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 text-body font-medium text-fg-primary">
                      <span className="truncate">{friend.nickname}</span>
                      <MembershipBadge active={friend.membershipBadge} />
                      <RepresentativeTierBadge tier={friend.representativeTier} />
                    </p>
                    <p className="truncate text-caption text-fg-secondary">@{friend.handle}</p>
                    {friend.winRate !== null && <p className="text-caption text-fg-secondary">승률 {friend.winRate}%</p>}
                    {friend.mutualCount > 0 && <p className="text-caption text-fg-secondary">내가 팔로우하는 {friend.mutualCount}명이 팔로우</p>}
                  </div>
                </Link>
                <button type="button" aria-label={`${friend.nickname} 팔로우`} disabled={pendingHandle !== null} onClick={() => void handleFollow(friend)} className="btn-secondary h-8 shrink-0 px-3">
                  {pendingHandle === friend.handle ? '팔로우 중...' : '팔로우'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {followError && <p role="alert" className="pb-3 text-caption text-fg-secondary">{followError}</p>}
      </div>
    </section>
  );
}
