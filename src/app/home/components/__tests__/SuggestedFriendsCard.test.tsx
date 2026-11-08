import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRecommendation } from '@/lib/feed-api';

const mocks = vi.hoisted(() => ({
  fetchUserRecommendations: vi.fn(),
  followUser: vi.fn(),
  requireAuth: vi.fn(),
  auth: {
    user: { id: 'viewer' } as { id: string } | null,
    isAuthReady: true,
    isLoggingOut: false,
    isAccountBlocked: false,
    isSessionUnavailable: false,
  },
}));

vi.mock('@/app/context/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/useRequireAuth', () => ({ useRequireAuth: () => mocks.requireAuth }));
vi.mock('@/lib/feed-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/feed-api')>()),
  fetchUserRecommendations: mocks.fetchUserRecommendations,
  followUser: mocks.followUser,
}));

import { SuggestedFriendsCard } from '../SuggestedFriendsCard';

const friend: UserRecommendation = {
  userId: 'friend', handle: 'friend', nickname: '추천유저', profileImageUrl: null,
  membershipBadge: true, mutualCount: 2,
  representativeTier: { game: 'LOL', tierLabel: 'MASTER' }, winRate: 58.5,
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mocks.auth, {
    user: { id: 'viewer' }, isAuthReady: true, isLoggingOut: false,
    isAccountBlocked: false, isSessionUnavailable: false,
  });
  mocks.fetchUserRecommendations.mockResolvedValue([friend]);
  mocks.followUser.mockResolvedValue(undefined);
  mocks.requireAuth.mockReturnValue(true);
});

describe('추천 친구', () => {
  it.each(['guest', 'restoring', 'logout', 'blocked', 'unavailable'])('%s 상태에서는 개인 API를 호출하지 않는다', (state) => {
    if (state === 'guest') mocks.auth.user = null;
    if (state === 'restoring') mocks.auth.isAuthReady = false;
    if (state === 'logout') mocks.auth.isLoggingOut = true;
    if (state === 'blocked') mocks.auth.isAccountBlocked = true;
    if (state === 'unavailable') mocks.auth.isSessionUnavailable = true;
    const { container } = render(<SuggestedFriendsCard />);
    expect(container).toBeEmptyDOMElement();
    expect(mocks.fetchUserRecommendations).not.toHaveBeenCalled();
  });

  it('로딩 후 프로필 링크·멤버십·티어·승률·공통 연결 수를 표시한다', async () => {
    render(<SuggestedFriendsCard />);
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중');
    expect(await screen.findByRole('link', { name: /추천유저/ })).toHaveAttribute('href', '/profile/friend');
    expect(screen.getByRole('img', { name: '멤버십 회원' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /MASTER/i })).toBeInTheDocument();
    expect(screen.getByText('승률 58.5%')).toBeInTheDocument();
    expect(screen.getByText('내가 팔로우하는 2명이 팔로우')).toBeInTheDocument();
    expect(screen.queryByText('예시')).not.toBeInTheDocument();
  });

  it('null 통계·배지는 숨기고 승률 0은 표시한다', async () => {
    mocks.fetchUserRecommendations.mockResolvedValue([
      { ...friend, membershipBadge: false, representativeTier: null, winRate: null, mutualCount: 0 },
      { ...friend, userId: 'zero', handle: 'zero', nickname: '영승률', winRate: 0 },
    ]);
    render(<SuggestedFriendsCard />);
    await screen.findByText('추천유저');
    expect(screen.getAllByText(/^승률/)).toHaveLength(1);
    expect(screen.getByText('승률 0%')).toBeInTheDocument();
    expect(screen.queryByText(/null|undefined/)).not.toBeInTheDocument();
  });

  it('빈 추천 목록을 표시한다', async () => {
    mocks.fetchUserRecommendations.mockResolvedValue([]);
    render(<SuggestedFriendsCard />);
    expect(await screen.findByText('아직 추천할 친구가 없습니다.')).toBeInTheDocument();
  });

  it('조회 오류는 다시 시도할 수 있다', async () => {
    mocks.fetchUserRecommendations.mockRejectedValueOnce(new Error('offline'));
    render(<SuggestedFriendsCard />);
    expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했습니다');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('추천유저')).toBeInTheDocument();
    expect(mocks.fetchUserRecommendations).toHaveBeenCalledTimes(2);
  });

  it('중복 팔로우를 막고 성공한 후보를 제거한다', async () => {
    let finish!: () => void;
    mocks.followUser.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    render(<SuggestedFriendsCard />);
    const button = await screen.findByRole('button', { name: '추천유저 팔로우' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(mocks.followUser).toHaveBeenCalledExactlyOnceWith('friend');
    await act(async () => finish());
    expect(screen.queryByText('추천유저')).not.toBeInTheDocument();
    expect(screen.getByText('아직 추천할 친구가 없습니다.')).toBeInTheDocument();
  });

  it('팔로우 실패 시 후보를 유지하고 재시도를 허용한다', async () => {
    mocks.followUser.mockRejectedValueOnce(new Error('offline'));
    render(<SuggestedFriendsCard />);
    fireEvent.click(await screen.findByRole('button', { name: '추천유저 팔로우' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('팔로우하지 못했습니다');
    const button = screen.getByRole('button', { name: '추천유저 팔로우' });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(screen.queryByText('추천유저')).not.toBeInTheDocument());
  });

  it('쓰기 직전에 인증 가드를 확인한다', async () => {
    mocks.requireAuth.mockReturnValue(false);
    render(<SuggestedFriendsCard />);
    fireEvent.click(await screen.findByRole('button', { name: '추천유저 팔로우' }));
    expect(mocks.followUser).not.toHaveBeenCalled();
    expect(screen.getByText('추천유저')).toBeInTheDocument();
  });

  it('계정 전환 시 이전 요청을 취소하고 늦은 응답을 버린다', async () => {
    let finish!: (users: UserRecommendation[]) => void;
    mocks.fetchUserRecommendations.mockReturnValueOnce(new Promise<UserRecommendation[]>((resolve) => { finish = resolve; }));
    const view = render(<SuggestedFriendsCard />);
    const signal = mocks.fetchUserRecommendations.mock.calls[0][0].signal as AbortSignal;
    mocks.auth.user = { id: 'other' };
    mocks.fetchUserRecommendations.mockResolvedValue([]);
    view.rerender(<SuggestedFriendsCard />);
    expect(signal.aborted).toBe(true);
    await screen.findByText('아직 추천할 친구가 없습니다.');
    await act(async () => finish([friend]));
    expect(screen.queryByText('추천유저')).not.toBeInTheDocument();
  });

  it('로그아웃 시 표시 중인 후보를 즉시 숨긴다', async () => {
    const view = render(<SuggestedFriendsCard />);
    await screen.findByText('추천유저');
    mocks.auth.isLoggingOut = true;
    view.rerender(<SuggestedFriendsCard />);
    expect(screen.queryByText('추천유저')).not.toBeInTheDocument();
  });

  it('이전 계정의 늦은 팔로우 완료가 새 계정의 후보를 제거하지 않는다', async () => {
    let finish!: () => void;
    mocks.followUser.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
    const view = render(<SuggestedFriendsCard />);
    fireEvent.click(await screen.findByRole('button', { name: '추천유저 팔로우' }));
    mocks.auth.user = { id: 'other' };
    view.rerender(<SuggestedFriendsCard />);
    await screen.findByText('추천유저');
    await act(async () => finish());
    expect(screen.getByText('추천유저')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '추천유저 팔로우' })).toBeEnabled();
  });
});
