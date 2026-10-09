import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminMentorApiItem, AdminMentoringProgramApiItem } from '@/lib/admin-mentoring-api';
import type { PageResponse } from '@/types/api';

const mentoringApi = vi.hoisted(() => ({
  fetchAdminMentoringSummary: vi.fn(),
  fetchAdminMentors: vi.fn(),
  fetchAdminMentoringPrograms: vi.fn(),
  approveAdminMentor: vi.fn(),
  rejectAdminMentor: vi.fn(),
  hideAdminMentoringProgram: vi.fn(),
  updateAdminProgramStatus: vi.fn(),
}));
vi.mock('@/lib/admin-mentoring-api', () => mentoringApi);

import { AdminMentoringManagement } from '../AdminMentoringManagement';

const mentor: AdminMentorApiItem = {
  userId: '11111111-1111-4111-8111-111111111111',
  name: '멘토 신청자',
  handle: 'mentor-handle',
  bio: '프로필 소개',
  ratingAvg: 4.5,
  reviewCount: 3,
  menteeCount: 4,
  status: 'PENDING_APPROVAL',
  appliedAt: '2026-10-07T00:00:00Z',
};
const program: AdminMentoringProgramApiItem = {
  id: '22222222-2222-4222-8222-222222222222',
  title: '게임 코칭',
  game: '리그 오브 레전드',
  mentorHandle: mentor.handle,
  mentorNickname: mentor.name,
  price: 3000,
  sessions: 12,
  rating: 4.5,
  reports: 15,
  status: 'ACTIVE',
  isHidden: false,
  createdAt: '2026-10-07T00:00:00Z',
};

function pageResponse<T>(content: T[], overrides: Partial<PageResponse<T>> = {}): PageResponse<T> {
  return { content, number: 0, size: 20, totalPages: content.length ? 1 : 0, totalElements: content.length, ...overrides };
}

async function openPrograms() {
  expect(await screen.findByText('@mentor-handle')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: '프로그램 관리' }));
  return screen.findByText('게임 코칭');
}

describe('AdminMentoringManagement', () => {
  beforeEach(() => {
    Object.values(mentoringApi).forEach((mock) => mock.mockReset());
    mentoringApi.fetchAdminMentoringSummary.mockResolvedValue({ pendingMentorCount: 3, activeProgramCount: 4, monthlySessionCount: 8, escrowHeldAmount: 9000 });
    mentoringApi.fetchAdminMentors.mockResolvedValue(pageResponse([mentor]));
    mentoringApi.fetchAdminMentoringPrograms.mockResolvedValue(pageResponse([program]));
    mentoringApi.approveAdminMentor.mockResolvedValue({ ...mentor, status: 'ACTIVE' });
    mentoringApi.rejectAdminMentor.mockResolvedValue({ ...mentor, status: 'INACTIVE' });
    mentoringApi.hideAdminMentoringProgram.mockResolvedValue({ ...program, isHidden: true });
    mentoringApi.updateAdminProgramStatus.mockResolvedValue({ ...program, status: 'CLOSED' });
  });

  it('loads real summary units and server mentor pages without unsupported columns', async () => {
    render(<AdminMentoringManagement />);
    expect(await screen.findByText('@mentor-handle')).toBeInTheDocument();
    expect(mentoringApi.fetchAdminMentors).toHaveBeenCalledWith({ status: undefined, page: 0, size: 20, sort: 'createdAt,desc' }, expect.any(AbortSignal));
    expect(screen.getByText('이번 달 신청 건수')).toBeInTheDocument();
    expect(screen.getByText('8건')).toBeInTheDocument();
    expect(screen.getByText('9,000P')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '주력 게임' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '경력' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '승인' })).toBeEnabled();
  });

  it('approves the user UUID and refetches list and summary after success', async () => {
    render(<AdminMentoringManagement />);
    fireEvent.click(await screen.findByRole('button', { name: '승인' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('멘토 프로필이 활성 상태');
    mentoringApi.fetchAdminMentors.mockResolvedValue(pageResponse([{ ...mentor, status: 'ACTIVE' }]));
    fireEvent.click(screen.getByRole('button', { name: '승인 확인' }));
    await waitFor(() => expect(mentoringApi.approveAdminMentor).toHaveBeenCalledWith(mentor.userId, expect.any(AbortSignal)));
    expect(await screen.findByText('활성', { selector: 'span' })).toBeInTheDocument();
    expect(mentoringApi.fetchAdminMentoringSummary).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('requires a rejection reason, preserves it after failure and retries with trimmed input', async () => {
    mentoringApi.rejectAdminMentor.mockRejectedValueOnce(new Error('반려 실패')).mockResolvedValueOnce({ ...mentor, status: 'INACTIVE' });
    render(<AdminMentoringManagement />);
    fireEvent.click(await screen.findByRole('button', { name: '반려' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: '반려 처리' }));
    expect(screen.getByRole('alert')).toHaveTextContent('반려 사유는 필수');
    expect(mentoringApi.rejectAdminMentor).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' 경력 확인 필요 ' } });
    fireEvent.click(screen.getByRole('button', { name: '반려 처리' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('반려 실패');
    expect(screen.getByRole('textbox')).toHaveValue(' 경력 확인 필요 ');
    mentoringApi.fetchAdminMentors.mockResolvedValue(pageResponse([{ ...mentor, status: 'INACTIVE' }]));
    fireEvent.click(screen.getByRole('button', { name: '반려 처리' }));
    await waitFor(() => expect(mentoringApi.rejectAdminMentor).toHaveBeenCalledTimes(2));
    expect(mentoringApi.rejectAdminMentor).toHaveBeenLastCalledWith(mentor.userId, '경력 확인 필요', expect.any(AbortSignal));
    expect(await screen.findByText('비활성', { selector: 'span' })).toBeInTheDocument();
  });

  it('locks duplicate submissions and prevents Escape from closing a pending action', async () => {
    let resolve!: (value: AdminMentorApiItem) => void;
    mentoringApi.approveAdminMentor.mockReturnValue(new Promise<AdminMentorApiItem>((done) => { resolve = done; }));
    render(<AdminMentoringManagement />);
    fireEvent.click(await screen.findByRole('button', { name: '승인' }));
    const confirm = screen.getByRole('button', { name: '승인 확인' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '처리 중…' })).toBeDisabled();
    expect(mentoringApi.approveAdminMentor).toHaveBeenCalledTimes(1);
    resolve({ ...mentor, status: 'ACTIVE' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('uses server program status and keyword filtering and hides unreliable report totals', async () => {
    render(<AdminMentoringManagement />);
    await openPrograms();
    expect(screen.queryByRole('columnheader', { name: '신고' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '신청 건수' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: '상태 전체' }), { target: { value: 'CLOSED' } });
    const search = screen.getByRole('searchbox', { name: '프로그램 제목 또는 멘토 닉네임 검색' });
    expect(search).toHaveAttribute('placeholder', '제목 · 멘토 닉네임 검색');
    fireEvent.change(search, { target: { value: ' 코칭 ' } });
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    await waitFor(() => expect(mentoringApi.fetchAdminMentoringPrograms).toHaveBeenLastCalledWith({ status: 'CLOSED', keyword: '코칭', page: 0, size: 20, sort: 'createdAt,desc' }, expect.any(AbortSignal)));
  });

  it('changes ACTIVE to CLOSED and displays 종료 without marking it hidden', async () => {
    render(<AdminMentoringManagement />);
    await openPrograms();
    fireEvent.click(screen.getByRole('button', { name: '종료' }));
    mentoringApi.fetchAdminMentoringPrograms.mockResolvedValue(pageResponse([{ ...program, status: 'CLOSED' }]));
    fireEvent.click(screen.getByRole('button', { name: '상태 변경 확인' }));
    await waitFor(() => expect(mentoringApi.updateAdminProgramStatus).toHaveBeenCalledWith(program.id, 'CLOSED', expect.any(AbortSignal)));
    expect(await screen.findByRole('button', { name: '운영 재개' })).toBeInTheDocument();
    expect(screen.getByText('종료', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByText('숨김 처리됨')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '운영 재개' }));
    fireEvent.click(screen.getByRole('button', { name: '상태 변경 확인' }));
    await waitFor(() => expect(mentoringApi.updateAdminProgramStatus).toHaveBeenLastCalledWith(program.id, 'ACTIVE', expect.any(AbortSignal)));
  });

  it('requires a hide reason and preserves ACTIVE separately when the program becomes hidden', async () => {
    render(<AdminMentoringManagement />);
    await openPrograms();
    fireEvent.click(screen.getByRole('button', { name: '숨김' }));
    fireEvent.click(screen.getByRole('button', { name: '숨김 처리' }));
    expect(screen.getByRole('alert')).toHaveTextContent('숨김 사유는 필수');
    expect(mentoringApi.hideAdminMentoringProgram).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' 운영 정책 위반 ' } });
    mentoringApi.fetchAdminMentoringPrograms.mockResolvedValue(pageResponse([{ ...program, isHidden: true }]));
    fireEvent.click(screen.getByRole('button', { name: '숨김 처리' }));
    await waitFor(() => expect(mentoringApi.hideAdminMentoringProgram).toHaveBeenCalledWith(program.id, '운영 정책 위반', expect.any(AbortSignal)));
    expect(await screen.findByText('숨김 처리됨')).toBeInTheDocument();
    expect(screen.getByText('운영 중', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '종료' })).not.toBeInTheDocument();
  });

  it('ignores the old mentor response after status filter changes', async () => {
    let resolve!: (value: PageResponse<AdminMentorApiItem>) => void;
    mentoringApi.fetchAdminMentors.mockReturnValueOnce(new Promise<PageResponse<AdminMentorApiItem>>((done) => { resolve = done; }))
      .mockResolvedValueOnce(pageResponse([{ ...mentor, name: '새 목록', status: 'ACTIVE' }]));
    render(<AdminMentoringManagement />);
    const oldSignal = mentoringApi.fetchAdminMentors.mock.calls[0][1] as AbortSignal;
    fireEvent.change(screen.getByRole('combobox', { name: '상태 전체' }), { target: { value: 'ACTIVE' } });
    expect(await screen.findByText('새 목록', { exact: false })).toBeInTheDocument();
    expect(oldSignal.aborted).toBe(true);
    await act(async () => { resolve(pageResponse([{ ...mentor, name: '오래된 목록' }])); });
    expect(screen.queryByText('오래된 목록', { exact: false })).not.toBeInTheDocument();
    expect(screen.getByText('새 목록', { exact: false })).toBeInTheDocument();
  });

  it('retries failed list requests and corrects an out-of-range final page', async () => {
    mentoringApi.fetchAdminMentors.mockRejectedValueOnce(new Error('조회 실패'))
      .mockResolvedValueOnce(pageResponse([mentor], { totalElements: 21, totalPages: 2 }))
      .mockResolvedValueOnce(pageResponse([], { number: 1 }))
      .mockResolvedValueOnce(pageResponse([mentor]));
    render(<AdminMentoringManagement />);
    expect(await screen.findByRole('alert')).toHaveTextContent('조회 실패');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('@mentor-handle')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(mentoringApi.fetchAdminMentors.mock.calls.map(([params]) => params.page)).toEqual([0, 0, 1, 0]));
    await waitFor(() => expect(within(screen.getByRole('table')).getByText('@mentor-handle')).toBeInTheDocument());
  });
});
