import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AdminReportApiItem,
  AdminReportPageResponse,
} from '@/lib/admin-report-api';

const adminReportApi = vi.hoisted(() => ({
  fetchAdminReports: vi.fn(),
  updateAdminReportStatus: vi.fn(),
}));
const reportApi = vi.hoisted(() => ({
  fetchReportReasons: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/admin-report-api', () => adminReportApi);
vi.mock('@/lib/report-api', () => reportApi);
vi.mock('@/hooks/useVisiblePolling', () => ({
  useVisiblePolling: vi.fn(),
}));

import { AdminReportsManagement } from '../AdminReportsManagement';

const report: AdminReportApiItem = {
  id: '11111111-1111-4111-8111-111111111111',
  reportCode: 'RPT-001',
  reporterId: '22222222-2222-4222-8222-222222222222',
  reporterNickname: '신고자',
  reporterHandle: 'reporter',
  targetType: 'POST',
  targetId: '33333333-3333-4333-8333-333333333333',
  targetSnippet: '신고된 게시글',
  reasonCode: 'SPAM',
  reasonLabel: '스팸',
  details: '반복 게시물입니다.',
  status: 'RECEIVED',
  assignedAdminId: null,
  assignedAdminNickname: null,
  createdAt: '2026-09-07T00:00:00Z',
  updatedAt: '2026-09-07T00:00:00Z',
};

function pageResponse(
  content: AdminReportApiItem[],
  overrides: Partial<AdminReportPageResponse> = {},
): AdminReportPageResponse {
  return {
    content,
    totalPages: content.length > 0 ? 1 : 0,
    totalElements: content.length,
    number: 0,
    size: 5,
    ...overrides,
  };
}

describe('AdminReportsManagement', () => {
  beforeEach(() => {
    adminReportApi.fetchAdminReports.mockReset();
    adminReportApi.updateAdminReportStatus.mockReset();
    reportApi.fetchReportReasons.mockReset();
    reportApi.fetchReportReasons.mockResolvedValue([
      { code: 'SPAM', label: '스팸' },
      { code: 'OTHER', label: '기타' },
    ]);
    adminReportApi.fetchAdminReports.mockResolvedValue(pageResponse([report]));
    adminReportApi.updateAdminReportStatus.mockResolvedValue({
      ...report,
      status: 'RESOLVED',
    });
  });

  it('uses the reason code returned by the API as the report query filter', async () => {
    render(<AdminReportsManagement />);

    expect(await screen.findByText('RPT-001')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: '전체 사유' }), {
      target: { value: 'SPAM' },
    });

    await waitFor(() => {
      expect(adminReportApi.fetchAdminReports).toHaveBeenLastCalledWith(
        expect.objectContaining({ reasonCode: 'SPAM', page: 0 }),
        expect.any(AbortSignal),
      );
    });
  });

  it('refetches the current filtered page after a successful status change', async () => {
    render(<AdminReportsManagement />);

    expect(await screen.findByText('RPT-001')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: '전체 상태' }), {
      target: { value: '접수' },
    });
    await waitFor(() => {
      expect(adminReportApi.fetchAdminReports).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'RECEIVED' }),
        expect.any(AbortSignal),
      );
    });
    const callsBeforeChange = adminReportApi.fetchAdminReports.mock.calls.length;

    fireEvent.change(screen.getByRole('combobox', { name: 'RPT-001 상태 변경' }), {
      target: { value: '처리 완료' },
    });

    await waitFor(() => {
      expect(adminReportApi.updateAdminReportStatus).toHaveBeenCalledWith(
        report.id,
        'RESOLVED',
      );
      expect(adminReportApi.fetchAdminReports.mock.calls.length).toBeGreaterThan(
        callsBeforeChange,
      );
      expect(adminReportApi.fetchAdminReports).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'RECEIVED', page: 0 }),
        expect.any(AbortSignal),
      );
    });
  });

  it('disables only the reason filter when reason loading fails and supports retry', async () => {
    reportApi.fetchReportReasons
      .mockRejectedValueOnce(new Error('사유 API 실패'))
      .mockResolvedValueOnce([{ code: 'SPAM', label: '스팸' }]);

    render(<AdminReportsManagement />);

    expect(await screen.findByText('RPT-001')).toBeInTheDocument();
    const failedReasonFilter = await screen.findByRole('combobox', {
      name: '사유 조회 실패',
    });
    expect(failedReasonFilter).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    await waitFor(() => {
      expect(reportApi.fetchReportReasons).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('combobox', { name: '전체 사유' })).toBeEnabled();
    });
  });

  it('keeps the existing row when the status update fails', async () => {
    adminReportApi.updateAdminReportStatus.mockRejectedValueOnce(
      new Error('상태 변경 실패'),
    );
    render(<AdminReportsManagement />);

    expect(await screen.findByText('RPT-001')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'RPT-001 상태 변경' }), {
      target: { value: '처리 완료' },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('상태 변경 실패');
    expect(screen.getByText('RPT-001')).toBeInTheDocument();
    expect(adminReportApi.fetchAdminReports).toHaveBeenCalledTimes(1);
  });

  it('moves back to the last valid page when the server page count shrinks', async () => {
    adminReportApi.fetchAdminReports
      .mockResolvedValueOnce(pageResponse([report], {
        totalPages: 2,
        totalElements: 6,
      }))
      .mockResolvedValueOnce(pageResponse([], {
        totalPages: 1,
        totalElements: 1,
        number: 1,
      }))
      .mockResolvedValueOnce(pageResponse([report], {
        totalPages: 1,
        totalElements: 1,
      }));

    render(<AdminReportsManagement />);
    expect(await screen.findByText('RPT-001')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() => {
      const requestedPages = adminReportApi.fetchAdminReports.mock.calls.map(
        ([params]) => params.page,
      );
      expect(requestedPages).toEqual([0, 1, 0]);
    });
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
