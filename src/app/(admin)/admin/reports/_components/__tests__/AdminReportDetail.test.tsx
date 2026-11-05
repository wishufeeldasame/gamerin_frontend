import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminReportDetailResponse } from '@/lib/admin-report-api';
import type { AdminUserResponse, UserPenaltyResponse } from '@/lib/admin-user-api';
import { ApiError } from '@/lib/api-client';
import { formatAbsoluteTime, UNKNOWN_TIME } from '@/lib/time-format';

const mocks = vi.hoisted(() => ({
  fetchAdminReportDetail: vi.fn(), startAdminReportReview: vi.fn(), resolveAdminReport: vi.fn(),
  fetchAdminUser: vi.fn(), fetchAdminUserPenalties: vi.fn(), user: { id: 'admin-id', role: 'ROLE_ADMIN' },
}));
vi.mock('@/app/context/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/lib/admin-report-api', () => mocks);
vi.mock('@/lib/admin-user-api', () => mocks);
import { AdminReportDetail } from '../AdminReportDetail';

const summary = { id: 'target-id', nickname: '대상 사용자', handle: 'target', joinedAt: '2026-01-01T00:00:00Z', reportsReceived: 2, activeSanction: '없음' };
const detail: AdminReportDetailResponse = {
  report: { id: 'report-id', reportCode: 'RPT-001', reporterId: 'reporter-id', reporterNickname: '신고자', targetType: 'POST', targetId: 'post-id', targetSnippet: '신고 당시 내용', reasonCode: 'SPAM', reasonLabel: '스팸', details: '상세 신고 내용', status: 'IN_REVIEW', assignedAdminId: 'admin-id', assignedAdminNickname: '관리자', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' },
  reporter: { ...summary, id: 'reporter-id', nickname: '신고자', handle: 'reporter' },
  targetUser: summary, contentHidden: false,
};
const target: AdminUserResponse = {
  id: 'target-id', handle: 'target', nickname: '대상 사용자', email: 'target@test.invalid', profileImageUrl: null,
  role: 'USER', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00Z', reportsReceivedCount: 2, activeSanction: '없음', activePenaltyId: null,
};
const penalty: UserPenaltyResponse = {
  id: 'penalty-id',
  userId: target.id,
  userNickname: target.nickname,
  reportId: detail.report.id,
  penaltyType: 'SUSPENSION_3D',
  reason: '미래 정지',
  startAt: '2026-10-08T00:00:00Z',
  endAt: '2030-10-11T00:00:00Z',
  isActive: true,
  administeredByAdminId: 'admin-id',
  administeredByAdminNickname: '관리자',
  createdAt: '2026-10-08T00:00:00Z',
};

describe('AdminReportDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: 'admin-id', role: 'ROLE_ADMIN' };
    mocks.fetchAdminReportDetail.mockResolvedValue(detail);
    mocks.fetchAdminUser.mockResolvedValue(target);
    mocks.fetchAdminUserPenalties.mockResolvedValue({ content: [], number: 0, size: 5, totalElements: 0, totalPages: 0 });
    mocks.resolveAdminReport.mockResolvedValue({ ...detail, report: { ...detail.report, status: 'RESOLVED' } });
  });

  it('loads actual detail and target permissions, hides unsupported controls and renders time metadata', async () => {
    render(<AdminReportDetail reportCode="RPT-001" />);
    expect(await screen.findByText('신고 상세 설명')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('combobox', { name: '사용자 제재' })).toBeEnabled());
    expect(mocks.fetchAdminUser).toHaveBeenCalledWith('target-id', expect.any(AbortSignal));
    expect(screen.queryByText('관련 신고 함께 처리')).not.toBeInTheDocument();
    expect(screen.queryByText('첨부 이미지 미리보기')).not.toBeInTheDocument();
    expect(screen.getByText('숨기지 않음')).toBeInTheDocument();
    const time = document.querySelector('time');
    expect(time).toHaveAttribute('datetime', '2026-01-01T00:00:00.000Z');
    expect(time?.getAttribute('title')).toContain('2026년');
  });

  it('renders finite penalty endAt values as absolute times and preserves null and invalid boundaries', async () => {
    const futureEndAt = '2030-10-11T00:00:00Z';
    const pastEndAt = '2020-01-02T03:04:00Z';
    mocks.fetchAdminUserPenalties.mockResolvedValue({
      content: [
        penalty,
        { ...penalty, id: 'past', penaltyType: 'SUSPENSION_7D', reason: '과거 정지', endAt: pastEndAt, isActive: false },
        { ...penalty, id: 'warning', penaltyType: 'WARNING', reason: '경고 기록', endAt: null },
        { ...penalty, id: 'permanent', penaltyType: 'PERMANENT_BAN', reason: '영구 기록', endAt: null },
        { ...penalty, id: 'invalid', penaltyType: 'SUSPENSION_30D', reason: '잘못된 종료 시각', endAt: 'not-a-date' },
      ],
      number: 0,
      size: 5,
      totalElements: 5,
      totalPages: 1,
    });

    render(<AdminReportDetail reportCode="RPT-001" />);
    await screen.findByText('잘못된 종료 시각');

    for (const [reason, endAt] of [['미래 정지', futureEndAt], ['과거 정지', pastEndAt]] as const) {
      const row = screen.getByText(reason).closest('li');
      expect(row).not.toBeNull();
      const times = row!.querySelectorAll('time');
      const endTime = times[1];
      const expected = formatAbsoluteTime(new Date(endAt));
      expect(endTime).toHaveAttribute('datetime', new Date(endAt).toISOString());
      expect(endTime).toHaveAttribute('title', expected);
      expect(endTime).toHaveTextContent(expected);
      expect(endTime).not.toHaveTextContent('방금 전');
    }

    expect(screen.getByText('경고 기록').closest('li')).toHaveTextContent('종료: 종료 시각 없음');
    expect(screen.getByText('영구 기록').closest('li')).toHaveTextContent('종료: 영구 정지');
    expect(screen.getByText('잘못된 종료 시각').closest('li')).toHaveTextContent(`종료: ${UNKNOWN_TIME}`);
  });

  it('treats an empty penalty endAt as invalid instead of an absent end time', async () => {
    mocks.fetchAdminUserPenalties.mockResolvedValue({
      content: [{ ...penalty, endAt: '' }],
      number: 0, size: 5, totalElements: 1, totalPages: 1,
    });

    render(<AdminReportDetail reportCode={'RPT-001'} />);
    const row = (await screen.findByText(penalty.reason)).closest('li');
    expect(row).toHaveTextContent(`종료: ${UNKNOWN_TIME}`);
    expect(row?.querySelectorAll('time')).toHaveLength(1);
  });

  it.each([
    [{ ...target, role: 'ADMIN' }, '관리자 및 본인'],
    [{ ...target, status: 'DELETED' }, '탈퇴한 계정'],
    [{ ...target, id: 'admin-id' }, '관리자 및 본인'],
  ])('blocks every penalty for a protected target %j', async (protectedTarget, message) => {
    mocks.fetchAdminUser.mockResolvedValue(protectedTarget);
    render(<AdminReportDetail reportCode="RPT-001" />);
    await waitFor(() => expect(screen.getByText(new RegExp(message))).toBeInTheDocument());
    expect(screen.getByRole('combobox', { name: '사용자 제재' })).toBeDisabled();
  });

  it('멘토링 프로그램 신고(GENERAL)는 숨기기 옵션을, 신청 건 신고는 환불 안내를 보여 준다', async () => {
    const mentoring = (stage: 'GENERAL' | 'FINISHED') => ({ ...detail, report: { ...detail.report, targetType: 'MENTORING' as const, stage } });
    mocks.fetchAdminReportDetail.mockResolvedValue(mentoring('GENERAL'));
    const { unmount } = render(<AdminReportDetail reportCode="RPT-001" />);
    expect(await screen.findByLabelText('멘토링 숨기기')).toBeInTheDocument();
    unmount();

    mocks.fetchAdminReportDetail.mockResolvedValue(mentoring('FINISHED'));
    render(<AdminReportDetail reportCode="RPT-001" />);
    expect(await screen.findByText(/전액 환불되며/)).toBeInTheDocument();
    expect(screen.queryByLabelText('멘토링 숨기기')).not.toBeInTheDocument();
  });

  it('판정 응답의 escrowResult를 처리 결과에 표시한다', async () => {
    mocks.fetchAdminReportDetail.mockResolvedValueOnce(detail).mockResolvedValue({ ...detail, report: { ...detail.report, status: 'RESOLVED' } });
    mocks.resolveAdminReport.mockResolvedValueOnce({
      ...detail,
      report: { ...detail.report, status: 'RESOLVED' },
      escrowResult: { outcome: 'REFUNDED', note: '멘티에게 강제 환불되었습니다.' },
    });
    render(<AdminReportDetail reportCode="RPT-001" />);
    await waitFor(() => expect(screen.getByRole('combobox', { name: '사용자 제재' })).toBeEnabled());
    fireEvent.change(screen.getByPlaceholderText('처리 근거를 구체적으로 작성해 주세요. 이 내용은 작업 이력에 기록됩니다.'), { target: { value: '환불 사유' } });
    fireEvent.click(screen.getByRole('button', { name: '처리 내용 확인' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '처리 완료' }));
    expect(await screen.findByTestId('escrow-result')).toHaveTextContent('환불 - 멘티에게 강제 환불되었습니다.');
    // 판정 직후 재조회(escrowResult 없음)가 끝나도 결과를 유지한다.
    await waitFor(() => expect(mocks.fetchAdminReportDetail).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('escrow-result')).toBeInTheDocument();
  });

  it('keeps penalties disabled during lookup failure and allows retry', async () => {
    mocks.fetchAdminUser.mockRejectedValueOnce(new Error('조회 실패'));
    render(<AdminReportDetail reportCode="RPT-001" />);
    const retry = await screen.findByRole('button', { name: '대상 사용자 다시 확인' });
    expect(screen.getByRole('combobox', { name: '사용자 제재' })).toBeDisabled();
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByRole('combobox', { name: '사용자 제재' })).toBeEnabled());
  });

  it('submits a 3-day penalty in one integrated request and retains the status on failure', async () => {
    mocks.resolveAdminReport.mockRejectedValueOnce(new Error('이미 처리 완료되었거나 반려된 신고입니다.'));
    render(<AdminReportDetail reportCode="RPT-001" />);
    const select = await screen.findByRole('combobox', { name: '사용자 제재' });
    await waitFor(() => expect(select).toBeEnabled());
    fireEvent.change(select, { target: { value: 'SUSPENSION_3D' } });
    fireEvent.change(screen.getByPlaceholderText('처리 근거를 구체적으로 작성해 주세요. 이 내용은 작업 이력에 기록됩니다.'), { target: { value: '반복적인 스팸' } });
    fireEvent.click(screen.getByRole('button', { name: '처리 내용 확인' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '처리 완료' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('이미 처리 완료');
    expect(mocks.resolveAdminReport).toHaveBeenCalledTimes(1);
    expect(mocks.resolveAdminReport).toHaveBeenCalledWith('RPT-001', { decision: 'RESOLVED', hideTargetContent: false, penaltyType: 'SUSPENSION_3D', reason: '반복적인 스팸', internalMemo: null });
    expect(screen.getByRole('button', { name: '처리 내용 확인' })).toBeInTheDocument();
    expect(screen.queryByText('처리 완료된 신고입니다.')).not.toBeInTheDocument();
  });

  it('refetches the detail after a 409 and keeps the server message on the closed report', async () => {
    mocks.resolveAdminReport.mockRejectedValueOnce(new ApiError('이미 처리 완료되었거나 반려된 신고입니다.', 409));
    mocks.fetchAdminReportDetail
      .mockResolvedValueOnce(detail)
      .mockResolvedValueOnce({ ...detail, report: { ...detail.report, status: 'REJECTED' } });
    render(<AdminReportDetail reportCode="RPT-001" />);
    fireEvent.change(await screen.findByPlaceholderText('처리 근거를 구체적으로 작성해 주세요. 이 내용은 작업 이력에 기록됩니다.'), { target: { value: '근거' } });
    fireEvent.click(screen.getByRole('button', { name: '처리 내용 확인' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '처리 완료' }));

    expect(await screen.findByText('반려 처리된 신고입니다.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('이미 처리 완료');
    expect(mocks.fetchAdminReportDetail).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: '처리 내용 확인' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '검토 시작' })).not.toBeInTheDocument();
  });

  it('keeps the review form input when a 409 leaves the report in review', async () => {
    mocks.resolveAdminReport.mockRejectedValueOnce(new ApiError('이미 정산된 멘토링이라 환불할 수 없습니다.', 409));
    render(<AdminReportDetail reportCode="RPT-001" />);
    const reason = await screen.findByPlaceholderText('처리 근거를 구체적으로 작성해 주세요. 이 내용은 작업 이력에 기록됩니다.');
    fireEvent.change(reason, { target: { value: '보존할 근거' } });
    fireEvent.click(screen.getByRole('button', { name: '처리 내용 확인' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '처리 완료' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('환불할 수 없습니다');
    await waitFor(() => expect(mocks.fetchAdminReportDetail).toHaveBeenCalledTimes(2));
    expect(screen.getByPlaceholderText('처리 근거를 구체적으로 작성해 주세요. 이 내용은 작업 이력에 기록됩니다.')).toHaveValue('보존할 근거');
  });

  it('does not turn an absent target into zero reports or an actionable user', async () => {
    mocks.fetchAdminReportDetail.mockResolvedValue({ ...detail, targetUser: null });
    render(<AdminReportDetail reportCode="RPT-001" />);
    expect(await screen.findByText('대상 사용자 정보 없음')).toBeInTheDocument();
    expect(screen.getByText('정보 없음')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '사용자 제재' })).toBeDisabled();
    expect(mocks.fetchAdminUser).not.toHaveBeenCalled();
    expect(mocks.fetchAdminUserPenalties).not.toHaveBeenCalled();
  });

  it('discards a late detail response after switching reports', async () => {
    let release: ((value: AdminReportDetailResponse) => void) | undefined;
    mocks.fetchAdminReportDetail.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const { rerender } = render(<AdminReportDetail reportCode="RPT-OLD" />);
    mocks.fetchAdminReportDetail.mockResolvedValue({ ...detail, report: { ...detail.report, reportCode: 'RPT-NEW' } });
    rerender(<AdminReportDetail reportCode="RPT-NEW" />);
    expect(await screen.findByText('RPT-NEW')).toBeInTheDocument();
    release?.({ ...detail, report: { ...detail.report, reportCode: 'RPT-OLD' } });
    await waitFor(() => expect(screen.queryByText('RPT-OLD')).not.toBeInTheDocument());
  });
});
