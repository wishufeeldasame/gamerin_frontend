import { render, screen, waitFor } from '@testing-library/react';
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
const mentoringApi = vi.hoisted(() => ({
  acceptMentoringApplication: vi.fn(),
  applyToMentoringProgram: vi.fn(),
  cancelMentoringApplication: vi.fn(),
  completeMentoringApplication: vi.fn(),
  createMentoringProgram: vi.fn(),
  createMentoringReview: vi.fn(),
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
    user: { id: 'user-1' },
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
