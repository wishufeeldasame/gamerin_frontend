import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  MentoringApplicationResponse,
  MentoringProgramResponse,
  MentoringReviewResponse,
} from '@/lib/mentoring-api';

const navigation = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  push: vi.fn(),
}));
const auth = vi.hoisted(() => ({ userId: 'user-1' }));
const mentoringApi = vi.hoisted(() => ({
  acceptMentoringApplication: vi.fn(),
  applyToMentoringProgram: vi.fn(),
  cancelMentoringApplication: vi.fn(),
  completeMentoringApplication: vi.fn(),
  createMentoringProgram: vi.fn(),
  createMentoringReview: vi.fn(),
  fetchGames: vi.fn(),
  fetchMenteeApplications: vi.fn(),
  fetchMentorApplications: vi.fn(),
  fetchMentorProfile: vi.fn(),
  fetchMentorReviews: vi.fn(),
  fetchMentoringProgramDetail: vi.fn(),
  fetchMentoringPrograms: vi.fn(),
  fetchMyMentorProfile: vi.fn(),
  finishMentoringApplication: vi.fn(),
  registerMentor: vi.fn(),
  rejectMentoringApplication: vi.fn(),
  startMentoringApplication: vi.fn(),
  updateMentoringProgram: vi.fn(),
}));
const mileageApi = vi.hoisted(() => ({
  chargeMileage: vi.fn(),
  fetchMyMileageBalance: vi.fn(),
  fetchMyMileageTransactions: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => navigation.searchParams,
}));
vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: auth.userId },
    logout: vi.fn(),
    isAuthReady: true,
  }),
}));
vi.mock('@/lib/message-api', () => ({
  createConversation: vi.fn(),
}));
vi.mock('@/lib/mentoring-api', () => ({
  ...mentoringApi,
  emptyPage: (number = 0, size = 20) => ({
    content: [],
    totalPages: 0,
    totalElements: 0,
    number,
    size,
  }),
  isMentoringAuthError: () => false,
}));
vi.mock('@/lib/mileage-api', () => mileageApi);

import MentoringPage from '../page';

const application: MentoringApplicationResponse = {
  id: 'application-1',
  programId: 'program-1',
  programTitle: '랭크 게임 코칭',
  mentorId: 'mentor-1',
  mentorNickname: '멘토',
  menteeId: 'user-1',
  menteeNickname: '멘티',
  appliedMileage: 10000,
  status: 'COMPLETED',
  paymentStatus: 'SETTLED',
  message: '운영 피드백을 받고 싶어요.',
  createdAt: '2026-09-18T00:00:00Z',
  reviewed: true,
};

const program: MentoringProgramResponse = {
  id: 'program-1',
  mentorId: 'user-1',
  mentorNickname: '멘토',
  gameName: 'Valorant',
  title: '랭크 게임 코칭',
  content: '기본기 코칭',
  availableTimeDesc: '주말',
  status: 'ACTIVE',
  price: 10000,
  tags: [],
  createdAt: '2026-09-18T00:00:00Z',
};

const mentorProfile = {
  userId: 'user-1',
  nickname: '멘토',
  status: 'ACTIVE',
  about: '소개',
  ratingAvg: 5,
  reviewCount: 1,
  menteeCount: 1,
};

const games = [
  { code: 'PUBG', name: 'PUBG' },
  { code: 'LOL', name: 'League of Legends' },
];

const review: MentoringReviewResponse = {
  id: 'review-1',
  applicationId: application.id,
  programId: program.id,
  programTitle: program.title,
  menteeNickname: '멘티',
  rating: 5,
  content: '핵심을 정확히 짚어주셨어요.',
  createdAt: '2026-09-18T01:00:00Z',
};

function pageResponse<T>(content: T[]) {
  return {
    content,
    totalPages: content.length > 0 ? 1 : 0,
    totalElements: content.length,
    number: 0,
    size: 20,
    last: true,
  };
}

describe('MentoringPage deep links', () => {
  beforeEach(() => {
    navigation.searchParams = new URLSearchParams();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });

    mentoringApi.fetchGames.mockResolvedValue(games);
    mentoringApi.fetchMenteeApplications.mockResolvedValue(pageResponse([]));
    mentoringApi.fetchMentorApplications.mockResolvedValue(pageResponse([]));
    mentoringApi.fetchMentoringPrograms.mockResolvedValue(pageResponse([]));
    mentoringApi.fetchMyMentorProfile.mockResolvedValue({
      userId: 'user-1',
      nickname: '멘토',
      status: 'ACTIVE',
      about: '소개',
      ratingAvg: 5,
      reviewCount: 1,
      menteeCount: 1,
    });
    mentoringApi.fetchMentorReviews.mockResolvedValue(pageResponse([]));
    mileageApi.fetchMyMileageBalance.mockResolvedValue({ currentBalance: 50000 });
    mileageApi.fetchMyMileageTransactions.mockResolvedValue(pageResponse([]));
  });

  it('opens the mine tab and highlights the matching application', async () => {
    navigation.searchParams = new URLSearchParams('tab=mine&applicationId=application-1');
    mentoringApi.fetchMenteeApplications.mockResolvedValue(pageResponse([application]));

    render(<MentoringPage />);

    expect(await screen.findByText('랭크 게임 코칭')).toBeInTheDocument();
    const target = document.getElementById('mentoring-application-application-1');
    await waitFor(() => expect(target).toHaveClass('ring-2', 'ring-yellow-300'));
    await waitFor(() => expect(target?.scrollIntoView).toHaveBeenCalled());
  });

  it('opens the owned program and highlights a review identified by reviewId', async () => {
    navigation.searchParams = new URLSearchParams('reviewId=review-1');
    mentoringApi.fetchMentoringPrograms.mockResolvedValue(pageResponse([program]));
    mentoringApi.fetchMentorReviews.mockResolvedValue(pageResponse([review]));

    render(<MentoringPage />);

    expect(await screen.findByText(review.content)).toBeInTheDocument();
    const target = document.getElementById('mentoring-review-review-1');
    expect(target).toHaveClass('ring-2', 'ring-yellow-300');
    await waitFor(() => expect(target?.scrollIntoView).toHaveBeenCalled());
  });

  it('falls back to the default mentoring view when a review is unavailable', async () => {
    navigation.searchParams = new URLSearchParams('reviewId=missing-review');

    render(<MentoringPage />);

    expect(await screen.findByText('멘토링 프로그램 탐색')).toBeInTheDocument();
  });

  it('falls back to the default mentoring view when an application is unavailable', async () => {
    navigation.searchParams = new URLSearchParams('tab=mine&applicationId=missing-application');

    render(<MentoringPage />);

    expect(await screen.findByText('멘토링 프로그램 탐색')).toBeInTheDocument();
  });
});

describe('MentoringPage game filter', () => {
  beforeEach(() => {
    auth.userId = 'user-1';
    navigation.searchParams = new URLSearchParams();
    mentoringApi.fetchGames.mockReset().mockResolvedValue(games);
    mentoringApi.fetchMenteeApplications.mockResolvedValue(pageResponse([]));
    mentoringApi.fetchMentorApplications.mockResolvedValue(pageResponse([]));
    mentoringApi.fetchMentoringPrograms.mockReset().mockResolvedValue(pageResponse([]));
    mentoringApi.fetchMyMentorProfile.mockResolvedValue(null);
    mileageApi.fetchMyMileageBalance.mockResolvedValue({ currentBalance: 0 });
    mileageApi.fetchMyMileageTransactions.mockResolvedValue(pageResponse([]));
  });

  it('필터 선택지는 /games 응답이고, 선택한 코드로 조회하며, 빈 결과에서 초기화한다', async () => {
    const user = userEvent.setup();
    mentoringApi.fetchMentoringPrograms.mockImplementation(async ({ gameName }: { gameName?: string }) =>
      pageResponse(gameName ? [] : [{ ...program, gameName: 'PUBG' }]),
    );
    render(<MentoringPage />);

    const select = await screen.findByRole('combobox');
    await waitFor(() => expect(select).toBeEnabled());
    expect(await screen.findByText(program.title)).toBeInTheDocument();
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      '전체',
      'PUBG',
      'League of Legends',
    ]);
    expect(mentoringApi.fetchMentoringPrograms).toHaveBeenLastCalledWith(
      expect.objectContaining({ gameName: undefined }),
    );
    expect(screen.queryByRole('button', { name: '필터 초기화' })).not.toBeInTheDocument();

    await user.selectOptions(select, 'LOL');
    await waitFor(() =>
      expect(mentoringApi.fetchMentoringPrograms).toHaveBeenLastCalledWith(
        expect.objectContaining({ gameName: 'LOL' }),
      ),
    );
    await waitFor(() => expect(screen.queryByText(program.title)).not.toBeInTheDocument());

    await user.click(await screen.findByRole('button', { name: '필터 초기화' }));
    await waitFor(() =>
      expect(mentoringApi.fetchMentoringPrograms).toHaveBeenLastCalledWith(
        expect.objectContaining({ gameName: undefined }),
      ),
    );
    expect(select).toHaveValue('');
    expect(await screen.findByText(program.title)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '필터 초기화' })).not.toBeInTheDocument();
  });

  it('카드 배지는 서버 표시명으로 보여 준다', async () => {
    mentoringApi.fetchMentoringPrograms.mockResolvedValue(pageResponse([{ ...program, gameName: 'LOL' }]));
    render(<MentoringPage />);

    const badge = await screen.findByText('League of Legends', { selector: 'span' });
    expect(badge).toBeInTheDocument();
  });

  it('/games 실패 시 한국어 안내를 보이고 필터를 비활성화한다', async () => {
    mentoringApi.fetchGames.mockRejectedValue(new Error('boom'));
    render(<MentoringPage />);

    expect(await screen.findByText(/게임 목록을 불러오지 못했습니다/)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('/games 실패 안내와 다시 시도는 프로그램 등록 폼에도 보인다', async () => {
    const user = userEvent.setup();
    mentoringApi.fetchGames.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(games);
    mentoringApi.fetchMyMentorProfile.mockResolvedValue({
      userId: 'user-1',
      nickname: '멘토',
      status: 'ACTIVE',
      about: '소개',
      ratingAvg: 5,
      reviewCount: 1,
      menteeCount: 1,
    });
    render(<MentoringPage />);

    await user.click(await screen.findByRole('button', { name: '멘토 되기' }));
    expect(await screen.findByText('프로그램 만들기')).toBeInTheDocument();
    expect(screen.getByText(/게임 목록을 불러오지 못했습니다/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(screen.getByRole('option', { name: 'League of Legends' })).toBeInTheDocument());
    expect(screen.queryByText(/게임 목록을 불러오지 못했습니다/)).not.toBeInTheDocument();
  });

  it('게임 목록 로딩 중에는 안내를 보이고 프로그램 등록을 막는다', async () => {
    const user = userEvent.setup();
    mentoringApi.fetchGames.mockReturnValue(new Promise(() => {}));
    mentoringApi.fetchMyMentorProfile.mockResolvedValue({
      userId: 'user-1',
      nickname: '멘토',
      status: 'ACTIVE',
      about: '소개',
      ratingAvg: 5,
      reviewCount: 1,
      menteeCount: 1,
    });
    render(<MentoringPage />);

    await user.click(await screen.findByRole('button', { name: '멘토 되기' }));
    expect(await screen.findByText('프로그램 만들기')).toBeInTheDocument();
    expect(screen.getByText('게임 목록을 불러오는 중입니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '프로그램 등록' })).toBeDisabled();
  });

  it('오래된 /games 실패는 최신 성공 결과를 덮지 않는다', async () => {
    let rejectFirst: (reason: Error) => void = () => {};
    mentoringApi.fetchGames
      .mockReturnValueOnce(new Promise((_, reject) => { rejectFirst = reject; }))
      .mockResolvedValue(games);
    const { rerender } = render(<MentoringPage />);
    await waitFor(() => expect(mentoringApi.fetchGames).toHaveBeenCalledTimes(1));

    // 첫 요청이 끝나기 전에 사용자 전환으로 두 번째 요청이 시작되어 성공한다.
    auth.userId = 'user-2';
    rerender(<MentoringPage />);
    await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());

    await act(async () => {
      rejectFirst(new Error('late'));
    });
    expect(screen.getByRole('combobox')).toBeEnabled();
    expect(screen.queryByText(/게임 목록을 불러오지 못했습니다/)).not.toBeInTheDocument();
  });

  it('폼에서 고른 게임은 표시명이 아니라 코드로 전송한다', async () => {
    const user = userEvent.setup();
    mentoringApi.fetchMyMentorProfile.mockResolvedValue(mentorProfile);
    mentoringApi.createMentoringProgram.mockResolvedValue(program);
    const { container } = render(<MentoringPage />);

    await user.click(await screen.findByRole('button', { name: '멘토 되기' }));
    const select = await screen.findByDisplayValue('PUBG');
    await user.selectOptions(select, 'LOL');
    await user.type(container.querySelector('input[name=title]')!, '롤 코칭');
    for (const field of container.querySelectorAll(
      'form input:not([name=price]):not([name=title]):not([name=gameName]), form textarea',
    )) {
      await user.type(field, '내용');
    }
    await user.click(screen.getByRole('button', { name: '프로그램 등록' }));

    await waitFor(() =>
      expect(mentoringApi.createMentoringProgram).toHaveBeenCalledWith(
        expect.objectContaining({ gameName: 'LOL' }),
      ),
    );
  });

  it('게임 목록 재조회가 실패하면 이전 목록이 남아 있어도 등록을 막는다', async () => {
    const user = userEvent.setup();
    mentoringApi.fetchMyMentorProfile.mockResolvedValue(mentorProfile);
    mentoringApi.fetchGames.mockResolvedValueOnce(games).mockRejectedValue(new Error('boom'));
    const { rerender } = render(<MentoringPage />);

    await user.click(await screen.findByRole('button', { name: '멘토 되기' }));
    await screen.findByDisplayValue('PUBG');
    expect(screen.getByRole('button', { name: '프로그램 등록' })).toBeEnabled();

    auth.userId = 'user-2';
    rerender(<MentoringPage />);

    expect(await screen.findByText(/게임 목록을 불러오지 못했습니다/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '프로그램 등록' })).toBeDisabled();
  });
});
