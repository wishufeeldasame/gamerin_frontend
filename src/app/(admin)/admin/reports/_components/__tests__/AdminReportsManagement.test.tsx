import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminReportApiItem } from '@/lib/admin-report-api';
import type { PageResponse } from '@/types/api';

const adminReportApi = vi.hoisted(() => ({
  fetchAdminReports: vi.fn(),
  updateAdminReportStatus: vi.fn(),
}));
const reportApi = vi.hoisted(() => ({
  fetchReportReasons: vi.fn(),
}));
const polling = vi.hoisted(() => ({
  useVisiblePolling: vi.fn(),
}));
const authState = vi.hoisted(() => ({
  user: { id: 'admin-a' } as { id: string } | null,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => ({ user: authState.user }),
}));
vi.mock('@/lib/admin-report-api', () => adminReportApi);
vi.mock('@/lib/report-api', () => reportApi);
vi.mock('@/hooks/useVisiblePolling', () => polling);

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

const secondReport: AdminReportApiItem = {
  ...report,
  id: '44444444-4444-4444-8444-444444444444',
  reportCode: 'RPT-002',
  targetId: '55555555-5555-4555-8555-555555555555',
  targetSnippet: '두 번째 신고',
  status: 'IN_REVIEW',
};

const resolvedReport: AdminReportApiItem = {
  ...report,
  status: 'RESOLVED',
  assignedAdminId: '66666666-6666-4666-8666-666666666666',
  assignedAdminNickname: '관리자',
  updatedAt: '2026-09-07T01:00:00Z',
};

function pageResponse(
  content: AdminReportApiItem[],
  overrides: Partial<PageResponse<AdminReportApiItem>> = {},
): PageResponse<AdminReportApiItem> {
  return {
    content,
    totalPages: content.length > 0 ? 1 : 0,
    totalElements: content.length,
    number: 0,
    size: 5,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function renderLoaded(content = [report]) {
  render(<AdminReportsManagement />);
  for (const item of content) {
    expect(await screen.findByText(item.reportCode)).toBeInTheDocument();
  }
}

function statusSelect(reportCode: string) {
  return screen.getByRole('combobox', { name: `${reportCode} 상태 변경` });
}

describe('AdminReportsManagement', () => {
  beforeEach(() => {
    authState.user = { id: 'admin-a' };
    adminReportApi.fetchAdminReports.mockReset();
    adminReportApi.updateAdminReportStatus.mockReset();
    reportApi.fetchReportReasons.mockReset();
    polling.useVisiblePolling.mockReset();
    reportApi.fetchReportReasons.mockResolvedValue([
      { code: 'SPAM', label: '스팸' },
      { code: 'OTHER', label: '기타' },
    ]);
    adminReportApi.fetchAdminReports.mockResolvedValue(pageResponse([report]));
    adminReportApi.updateAdminReportStatus.mockResolvedValue(resolvedReport);
  });

  it('uses the reason code returned by the API as the report query filter', async () => {
    await renderLoaded();

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

  it('applies the PATCH DTO immediately and keeps only that row locked after GET failure', async () => {
    adminReportApi.fetchAdminReports
      .mockResolvedValueOnce(pageResponse([report, secondReport]))
      .mockRejectedValueOnce(new Error('목록 실패'))
      .mockResolvedValueOnce(pageResponse([resolvedReport, secondReport]));

    await renderLoaded([report, secondReport]);
    const firstSelect = statusSelect('RPT-001');
    fireEvent.change(firstSelect, {
      target: { value: '처리 완료' },
    });

    expect(await screen.findByText(
      '상태 변경은 완료됐지만 목록을 갱신하지 못했습니다. 새로고침해주세요.',
    )).toBeInTheDocument();
    expect(statusSelect('RPT-001')).toHaveValue('처리 완료');
    expect(firstSelect).toBeDisabled();
    expect(statusSelect('RPT-002')).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
    await waitFor(() => expect(statusSelect('RPT-001')).toBeEnabled());
    expect(screen.queryByText(
      '상태 변경은 완료됐지만 목록을 갱신하지 못했습니다. 새로고침해주세요.',
    )).not.toBeInTheDocument();
    expect(adminReportApi.updateAdminReportStatus).toHaveBeenCalledTimes(1);
  });

  it('does not send a PATCH when the selected status is unchanged', async () => {
    await renderLoaded();

    fireEvent.change(statusSelect('RPT-001'), {
      target: { value: '접수' },
    });

    expect(adminReportApi.updateAdminReportStatus).not.toHaveBeenCalled();
  });

  it('rejects a synthetic change on a report that is waiting for successful resync', async () => {
    adminReportApi.fetchAdminReports
      .mockResolvedValueOnce(pageResponse([report]))
      .mockRejectedValue(new Error('목록 실패'));
    await renderLoaded();
    fireEvent.change(statusSelect('RPT-001'), { target: { value: '처리 완료' } });
    expect(await screen.findByText(
      '상태 변경은 완료됐지만 목록을 갱신하지 못했습니다. 새로고침해주세요.',
    )).toBeInTheDocument();
    fireEvent.change(statusSelect('RPT-001'), { target: { value: '검토 중' } });
    expect(adminReportApi.updateAdminReportStatus).toHaveBeenCalledTimes(1);
  });

  it('cannot unlock a committed row with a GET that started before the PATCH succeeded', async () => {
    const oldGet = deferred<PageResponse<AdminReportApiItem>>();
    const patch = deferred<AdminReportApiItem>();
    adminReportApi.fetchAdminReports
      .mockResolvedValueOnce(pageResponse([report]))
      .mockImplementationOnce(() => oldGet.promise)
      .mockRejectedValueOnce(new Error('목록 실패'));
    adminReportApi.updateAdminReportStatus.mockImplementationOnce(() => patch.promise);
    await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
    await waitFor(() => expect(adminReportApi.fetchAdminReports).toHaveBeenCalledTimes(2));
    const oldSignal = adminReportApi.fetchAdminReports.mock.calls[1][1] as AbortSignal;
    fireEvent.change(statusSelect('RPT-001'), { target: { value: '처리 완료' } });
    patch.resolve(resolvedReport);
    expect(await screen.findByText(
      '상태 변경은 완료됐지만 목록을 갱신하지 못했습니다. 새로고침해주세요.',
    )).toBeInTheDocument();
    expect(oldSignal.aborted).toBe(true);
    oldGet.resolve(pageResponse([report]));
    await act(async () => { await Promise.resolve(); });
    expect(statusSelect('RPT-001')).toHaveValue('처리 완료');
    expect(statusSelect('RPT-001')).toBeDisabled();
    expect(adminReportApi.updateAdminReportStatus).toHaveBeenCalledTimes(1);
  });

  it('allows another report mutation while the first report awaits resync', async () => {
    const resolvedSecondReport: AdminReportApiItem = {
      ...secondReport,
      status: 'RESOLVED',
    };
    adminReportApi.fetchAdminReports
      .mockResolvedValueOnce(pageResponse([report, secondReport]))
      .mockRejectedValueOnce(new Error('첫 목록 실패'))
      .mockResolvedValueOnce(pageResponse([resolvedReport, resolvedSecondReport]));
    adminReportApi.updateAdminReportStatus
      .mockResolvedValueOnce(resolvedReport)
      .mockResolvedValueOnce(resolvedSecondReport);

    await renderLoaded([report, secondReport]);
    fireEvent.change(statusSelect('RPT-001'), {
      target: { value: '처리 완료' },
    });
    expect(await screen.findByText(
      '상태 변경은 완료됐지만 목록을 갱신하지 못했습니다. 새로고침해주세요.',
    )).toBeInTheDocument();

    fireEvent.change(statusSelect('RPT-002'), {
      target: { value: '처리 완료' },
    });

    await waitFor(() => {
      expect(adminReportApi.updateAdminReportStatus).toHaveBeenNthCalledWith(
        2,
        secondReport.id,
        'RESOLVED',
        expect.any(AbortSignal),
      );
    });
    await waitFor(() => expect(statusSelect('RPT-002')).toHaveValue('처리 완료'));
  });

  it('allows another PATCH while the first follow-up GET is still pending', async () => {
    const firstGet = deferred<PageResponse<AdminReportApiItem>>();
    const secondPatch = deferred<AdminReportApiItem>();
    const resolvedSecond = { ...secondReport, status: 'RESOLVED' as const };
    adminReportApi.fetchAdminReports
      .mockResolvedValueOnce(pageResponse([report, secondReport]))
      .mockImplementationOnce(() => firstGet.promise)
      .mockResolvedValueOnce(pageResponse([resolvedReport, resolvedSecond]));
    adminReportApi.updateAdminReportStatus
      .mockResolvedValueOnce(resolvedReport)
      .mockImplementationOnce(() => secondPatch.promise);
    await renderLoaded([report, secondReport]);
    fireEvent.change(statusSelect('RPT-001'), { target: { value: '처리 완료' } });
    await waitFor(() => expect(adminReportApi.fetchAdminReports).toHaveBeenCalledTimes(2));
    expect(statusSelect('RPT-001')).toBeDisabled();
    fireEvent.change(statusSelect('RPT-002'), { target: { value: '처리 완료' } });
    expect(adminReportApi.updateAdminReportStatus).toHaveBeenCalledTimes(2);
    firstGet.reject(new Error('첫 조회 실패'));
    await act(async () => { await Promise.resolve(); });
    expect(statusSelect('RPT-002')).toBeDisabled();
    secondPatch.resolve(resolvedSecond);
    await waitFor(() => expect(statusSelect('RPT-002')).toBeEnabled());
    expect(statusSelect('RPT-001')).toHaveValue('처리 완료');
    expect(statusSelect('RPT-002')).toHaveValue('처리 완료');
  });

  it('removes the updated row immediately when it no longer matches the status filter', async () => {
    const followup = deferred<PageResponse<AdminReportApiItem>>();
    adminReportApi.fetchAdminReports
      .mockResolvedValueOnce(pageResponse([report]))
      .mockResolvedValueOnce(pageResponse([report]))
      .mockImplementationOnce(() => followup.promise);

    await renderLoaded();
    fireEvent.change(screen.getByRole('combobox', { name: '전체 상태' }), {
      target: { value: '접수' },
    });
    await waitFor(() => {
      expect(adminReportApi.fetchAdminReports).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'RECEIVED' }),
        expect.any(AbortSignal),
      );
    });

    fireEvent.change(statusSelect('RPT-001'), {
      target: { value: '처리 완료' },
    });
    await waitFor(() => expect(screen.queryByText('RPT-001')).not.toBeInTheDocument());

    followup.reject(new Error('목록 실패'));
    expect(await screen.findByText(
      '건수와 페이지 정보는 마지막 조회 기준이며, 새로고침 후 확정됩니다.',
    )).toBeInTheDocument();
    expect(screen.getByText('1', { selector: 'strong' })).toBeInTheDocument();
    adminReportApi.fetchAdminReports.mockResolvedValueOnce(pageResponse([]));
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
    await waitFor(() => expect(screen.getByText('0', { selector: 'strong' })).toBeInTheDocument());
    expect(adminReportApi.updateAdminReportStatus).toHaveBeenCalledTimes(1);
  });

  it('uses the latest page and filter after a delayed PATCH resolves', async () => {
    const patch = deferred<AdminReportApiItem>();
    adminReportApi.fetchAdminReports.mockResolvedValue(pageResponse([report], {
      totalPages: 2,
      totalElements: 6,
    }));
    adminReportApi.updateAdminReportStatus.mockImplementationOnce(() => patch.promise);

    await renderLoaded();
    fireEvent.change(statusSelect('RPT-001'), {
      target: { value: '처리 완료' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: '전체 유형' }), {
      target: { value: '게시글' },
    });
    await waitFor(() => {
      expect(adminReportApi.fetchAdminReports).toHaveBeenLastCalledWith(
        expect.objectContaining({ targetType: 'POST', page: 0 }),
        expect.any(AbortSignal),
      );
    });
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => {
      expect(adminReportApi.fetchAdminReports).toHaveBeenLastCalledWith(
        expect.objectContaining({ targetType: 'POST', page: 1 }),
        expect.any(AbortSignal),
      );
    });
    const callsBeforePatchResolution = adminReportApi.fetchAdminReports.mock.calls.length;

    patch.resolve(resolvedReport);
    await waitFor(() => {
      expect(adminReportApi.fetchAdminReports.mock.calls.length)
        .toBeGreaterThan(callsBeforePatchResolution);
      expect(adminReportApi.fetchAdminReports).toHaveBeenLastCalledWith(
        expect.objectContaining({ targetType: 'POST', page: 1 }),
        expect.any(AbortSignal),
      );
    });
  });

  it('ignores an older GET that resolves after the query changes', async () => {
    const staleRequest = deferred<PageResponse<AdminReportApiItem>>();
    adminReportApi.fetchAdminReports
      .mockResolvedValueOnce(pageResponse([report]))
      .mockImplementationOnce(() => staleRequest.promise)
      .mockResolvedValueOnce(pageResponse([secondReport]));

    await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
    await waitFor(() => expect(adminReportApi.fetchAdminReports).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByRole('combobox', { name: '전체 상태' }), {
      target: { value: '검토 중' },
    });

    expect(await screen.findByText('RPT-002')).toBeInTheDocument();
    staleRequest.resolve(pageResponse([report]));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('RPT-002')).toBeInTheDocument();
    expect(screen.queryByText('RPT-001')).not.toBeInTheDocument();
  });

  it('blocks same-tick duplicate mutations with a synchronous ref', async () => {
    const patch = deferred<AdminReportApiItem>();
    adminReportApi.updateAdminReportStatus.mockImplementationOnce(() => patch.promise);
    await renderLoaded();
    const select = statusSelect('RPT-001');

    act(() => {
      fireEvent.change(select, { target: { value: '처리 완료' } });
      fireEvent.change(select, { target: { value: '검토 중' } });
    });

    expect(adminReportApi.updateAdminReportStatus).toHaveBeenCalledTimes(1);
    patch.resolve(resolvedReport);
  });

  it('preserves the row and does not refetch after PATCH failure', async () => {
    adminReportApi.updateAdminReportStatus.mockRejectedValueOnce(
      new Error('상태 변경 실패'),
    );
    await renderLoaded();
    const callsBeforeChange = adminReportApi.fetchAdminReports.mock.calls.length;

    fireEvent.change(statusSelect('RPT-001'), {
      target: { value: '처리 완료' },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('상태 변경 실패');
    expect(screen.getByText('RPT-001')).toBeInTheDocument();
    expect(statusSelect('RPT-001')).toHaveValue('접수');
    expect(statusSelect('RPT-001')).toBeEnabled();
    expect(adminReportApi.fetchAdminReports).toHaveBeenCalledTimes(callsBeforeChange);
  });

  it('aborts and ignores a late PATCH when the account changes', async () => {
    const patch = deferred<AdminReportApiItem>();
    adminReportApi.fetchAdminReports
      .mockResolvedValueOnce(pageResponse([report]))
      .mockResolvedValueOnce(pageResponse([secondReport]));
    adminReportApi.updateAdminReportStatus.mockImplementationOnce(() => patch.promise);
    const view = render(<AdminReportsManagement />);
    expect(await screen.findByText('RPT-001')).toBeInTheDocument();

    fireEvent.change(statusSelect('RPT-001'), {
      target: { value: '처리 완료' },
    });
    const mutationSignal = adminReportApi.updateAdminReportStatus.mock.calls[0][2];
    authState.user = { id: 'admin-b' };
    view.rerender(<AdminReportsManagement />);

    expect(await screen.findByText('RPT-002')).toBeInTheDocument();
    expect(mutationSignal).toBeInstanceOf(AbortSignal);
    expect(mutationSignal.aborted).toBe(true);
    patch.resolve(resolvedReport);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('RPT-002')).toBeInTheDocument();
    expect(screen.queryByText('RPT-001')).not.toBeInTheDocument();
  });

  it('aborts the PATCH on unmount', async () => {
    const patch = deferred<AdminReportApiItem>();
    adminReportApi.updateAdminReportStatus.mockImplementationOnce(() => patch.promise);
    const view = render(<AdminReportsManagement />);
    expect(await screen.findByText('RPT-001')).toBeInTheDocument();
    fireEvent.change(statusSelect('RPT-001'), {
      target: { value: '처리 완료' },
    });
    const mutationSignal = adminReportApi.updateAdminReportStatus.mock.calls[0][2];

    view.unmount();
    expect(mutationSignal.aborted).toBe(true);
    patch.resolve(resolvedReport);
  });

  it('does not unlock on a last-page correction until the corrected GET applies', async () => {
    const correctedPage = deferred<PageResponse<AdminReportApiItem>>();
    adminReportApi.fetchAdminReports
      .mockResolvedValueOnce(pageResponse([report], { totalPages: 2, totalElements: 6 }))
      .mockResolvedValueOnce(pageResponse([report], {
        totalPages: 2,
        totalElements: 6,
        number: 1,
      }))
      .mockResolvedValueOnce(pageResponse([], {
        totalPages: 1,
        totalElements: 1,
        number: 1,
      }))
      .mockImplementationOnce(() => correctedPage.promise);

    await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => {
      expect(adminReportApi.fetchAdminReports).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1 }),
        expect.any(AbortSignal),
      );
    });
    const correctedPageSelect = statusSelect('RPT-001');
    fireEvent.change(correctedPageSelect, {
      target: { value: '처리 완료' },
    });

    await waitFor(() => {
      expect(adminReportApi.fetchAdminReports).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 0 }),
        expect.any(AbortSignal),
      );
    });
    expect(correctedPageSelect).toBeDisabled();

    correctedPage.resolve(pageResponse([resolvedReport]));
    await waitFor(() => expect(statusSelect('RPT-001')).toBeEnabled());
  });

  it('lets polling resync a locked row without reissuing PATCH', async () => {
    adminReportApi.fetchAdminReports
      .mockResolvedValueOnce(pageResponse([report]))
      .mockRejectedValueOnce(new Error('목록 실패'))
      .mockResolvedValueOnce(pageResponse([resolvedReport]));

    await renderLoaded();
    fireEvent.change(statusSelect('RPT-001'), {
      target: { value: '처리 완료' },
    });
    expect(await screen.findByText(
      '상태 변경은 완료됐지만 목록을 갱신하지 못했습니다. 새로고침해주세요.',
    )).toBeInTheDocument();

    const pollingCall = polling.useVisiblePolling.mock.calls.at(-1);
    expect(pollingCall).toBeDefined();
    await act(async () => {
      await pollingCall![0]();
    });

    expect(adminReportApi.updateAdminReportStatus).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(statusSelect('RPT-001')).toBeEnabled());
  });

  it('disables only the reason filter when reason loading fails and supports retry', async () => {
    reportApi.fetchReportReasons
      .mockRejectedValueOnce(new Error('사유 API 실패'))
      .mockResolvedValueOnce([{ code: 'SPAM', label: '스팸' }]);

    await renderLoaded();
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

    await renderLoaded();
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
