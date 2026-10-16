import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreatedReport } from '@/lib/report-api';
import type { PageResponse } from '@/types/api';
import { deferred } from '@/test/fetch-routes';

const mocks = vi.hoisted(() => ({
  fetchMyReports: vi.fn(),
  auth: { user: { id: 'user-a' } as { id: string } | null, isAuthReady: true, isLoggingOut: false },
}));
vi.mock('@/lib/report-api', () => ({ fetchMyReports: mocks.fetchMyReports }));
vi.mock('@/app/context/AuthContext', () => ({ useAuth: () => mocks.auth }));
import { MyReports } from '../MyReports';

const report: CreatedReport = {
  id: 'report-a', reportCode: 'RPT-1001', reporterId: 'user-a', reporterNickname: '나',
  targetType: 'POST', targetId: 'post-a', targetSnippet: null, reasonCode: 'SPAM',
  reasonLabel: '스팸 및 반복 홍보', details: null, status: 'RECEIVED',
  assignedAdminId: null, assignedAdminNickname: null,
  createdAt: '2026-10-07T00:00:00Z', updatedAt: '2026-10-07T00:00:00Z',
};
function page(content: CreatedReport[], overrides: Partial<PageResponse<CreatedReport>> = {}): PageResponse<CreatedReport> {
  return { content, number: 0, size: 20, totalPages: content.length ? 1 : 0, totalElements: content.length, ...overrides };
}

describe('MyReports', () => {
  beforeEach(() => {
    mocks.fetchMyReports.mockReset().mockResolvedValue(page([report]));
    mocks.auth.user = { id: 'user-a' };
    mocks.auth.isAuthReady = true;
    mocks.auth.isLoggingOut = false;
  });

  it('loads own reports, expands nullable content and never exposes admin controls', async () => {
    render(<MyReports />);
    expect(screen.getByText('내 신고를 불러오는 중입니다.')).toBeInTheDocument();
    expect(await screen.findByRole('cell', { name: 'RPT-1001' })).toBeInTheDocument();
    expect(mocks.fetchMyReports).toHaveBeenCalledWith({ page: 0, size: 20 }, expect.any(AbortSignal));
    fireEvent.click(screen.getByRole('button', { name: 'RPT-1001 내용 보기' }));
    expect(screen.getAllByText('정보 없음')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'RPT-1001 내용 접기' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: '설정으로 돌아가기' })).toHaveAttribute('href', '/settings');
    expect(document.querySelector('a[href^="/admin"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /판정|검토 시작|제재/ })).not.toBeInTheDocument();
  });

  it('requests server pages rather than filtering a local list', async () => {
    mocks.fetchMyReports.mockResolvedValueOnce(page([report], { totalPages: 2, totalElements: 21 }))
      .mockResolvedValueOnce(page([{ ...report, id: 'report-b', reportCode: 'RPT-1002', details: '신고 설명', targetSnippet: '접수 당시 내용' }], { number: 1, totalPages: 2, totalElements: 21 }));
    render(<MyReports />);
    await screen.findByRole('cell', { name: 'RPT-1001' });
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await screen.findByRole('cell', { name: 'RPT-1002' });
    expect(mocks.fetchMyReports).toHaveBeenLastCalledWith({ page: 1, size: 20 }, expect.any(AbortSignal));
    expect(screen.queryByText('RPT-1001')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'RPT-1002 내용 보기' }));
    expect(screen.getByText('신고 설명')).toBeInTheDocument();
    expect(screen.getByText('접수 당시 내용')).toBeInTheDocument();
  });

  it('shows the empty state only after a successful empty page', async () => {
    mocks.fetchMyReports.mockResolvedValue(page([]));
    render(<MyReports />);
    expect(await screen.findByText('접수한 신고가 없습니다.')).toBeInTheDocument();
  });

  it('shows an API failure and retries without an empty or dummy list', async () => {
    mocks.fetchMyReports.mockRejectedValueOnce(new Error('조회 실패')).mockResolvedValueOnce(page([report]));
    render(<MyReports />);
    expect(await screen.findByRole('alert')).toHaveTextContent('조회 실패');
    expect(screen.queryByText('접수한 신고가 없습니다.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('cell', { name: 'RPT-1001' })).toBeInTheDocument();
  });

  it('clears the previous user page and ignores their late response after an account switch', async () => {
    const late = deferred<PageResponse<CreatedReport>>();
    mocks.fetchMyReports.mockResolvedValueOnce(page([report], { totalPages: 2, totalElements: 21 }))
      .mockReturnValueOnce(late.promise)
      .mockResolvedValueOnce(page([{ ...report, id: 'next-report', reportCode: 'RPT-2001', reporterId: 'user-b' }]));
    const view = render(<MyReports />);
    await screen.findByRole('cell', { name: 'RPT-1001' });
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(mocks.fetchMyReports).toHaveBeenCalledTimes(2));
    const previousSignal = mocks.fetchMyReports.mock.calls[1][1] as AbortSignal;
    mocks.auth.user = { id: 'user-b' };
    view.rerender(<MyReports />);
    expect(previousSignal.aborted).toBe(true);
    await screen.findByRole('cell', { name: 'RPT-2001' });
    expect(mocks.fetchMyReports).toHaveBeenLastCalledWith({ page: 0, size: 20 }, expect.any(AbortSignal));
    await act(async () => late.resolve(page([{ ...report, reportCode: 'RPT-OLD' }], { number: 1 })));
    expect(screen.queryByText('RPT-OLD')).not.toBeInTheDocument();
    expect(screen.queryByText('RPT-1001')).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'RPT-2001' })).toBeInTheDocument();
  });

  it('aborts requests when the user logs out and does not fetch while auth is unresolved', async () => {
    mocks.auth.isAuthReady = false;
    const view = render(<MyReports />);
    expect(mocks.fetchMyReports).not.toHaveBeenCalled();
    const late = deferred<PageResponse<CreatedReport>>();
    mocks.fetchMyReports.mockReturnValue(late.promise);
    mocks.auth.isAuthReady = true;
    view.rerender(<MyReports />);
    await waitFor(() => expect(mocks.fetchMyReports).toHaveBeenCalledTimes(1));
    const signal = mocks.fetchMyReports.mock.calls[0][1] as AbortSignal;
    mocks.auth.user = null;
    view.rerender(<MyReports />);
    expect(signal.aborted).toBe(true);
    await act(async () => late.resolve(page([report])));
    expect(screen.queryByText('RPT-1001')).not.toBeInTheDocument();
  });
});
