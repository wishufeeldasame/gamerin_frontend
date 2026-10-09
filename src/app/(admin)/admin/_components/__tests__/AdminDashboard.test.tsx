import { StrictMode, type ReactNode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred } from '@/test/fetch-routes';
import type { AdminDashboardStats } from '@/lib/admin-dashboard-api';

const mocks = vi.hoisted(() => ({ fetchAdminDashboardStats: vi.fn(), fetchAdminReports: vi.fn() }));
vi.mock('@/lib/admin-dashboard-api', () => ({ fetchAdminDashboardStats: mocks.fetchAdminDashboardStats }));
vi.mock('@/lib/admin-report-api', () => ({ fetchAdminReports: mocks.fetchAdminReports }));
vi.mock('@/hooks/useVisiblePolling', () => ({ useVisiblePolling: vi.fn() }));
vi.mock('../AdminShell', () => ({ AdminShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
import { AdminDashboard } from '../AdminDashboard';

const stats: AdminDashboardStats = { receivedReportsCount: 12, inReviewReportsCount: 3, resolvedReportsCount: 401, rejectedReportsCount: 8, activePenaltiesCount: 7, hiddenContentsCount: 2 };
const emptyPage = { content: [], number: 0, size: 10, totalElements: 0, totalPages: 0 };
describe('AdminDashboard', () => {
  beforeEach(() => {
    mocks.fetchAdminDashboardStats.mockReset().mockResolvedValue(stats);
    mocks.fetchAdminReports.mockReset().mockResolvedValue(emptyPage);
  });

  it('renders actual counts with their backend meanings and keeps the ten-report request', async () => {
    render(<AdminDashboard />);
    const summary = await screen.findByRole('region', { name: '관리 현황 요약' });
    expect(within(summary).getByText('401')).toBeInTheDocument();
    expect(within(summary).getByText('처리 완료 상태 신고')).toBeInTheDocument();
    expect(within(summary).getByText('현재 처리 완료 상태인 신고 수')).toBeInTheDocument();
    expect(within(summary).queryByText('누적 처리 완료')).not.toBeInTheDocument();
    expect(within(summary).getByText('경고를 포함한 활성 제재 사용자')).toBeInTheDocument();
    expect(mocks.fetchAdminReports).toHaveBeenCalledWith({ page: 0, size: 10, sort: 'createdAt,desc' }, expect.any(AbortSignal));
    expect(screen.queryByText('신고 사유 분포')).not.toBeInTheDocument();
    expect(screen.queryByText(/예시 데이터/)).not.toBeInTheDocument();
    expect(screen.queryByText('오늘 처리 완료')).not.toBeInTheDocument();
  });

  it('shows a statistics error and supports retry instead of showing fabricated zero counts', async () => {
    mocks.fetchAdminDashboardStats.mockRejectedValueOnce(new Error('통계 오류')).mockResolvedValueOnce(stats);
    render(<AdminDashboard />);
    expect(await screen.findByRole('alert')).toHaveTextContent('통계 오류');
    expect(screen.queryByRole('region', { name: '관리 현황 요약' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('처리 완료 상태 신고')).toBeInTheDocument();
  });

  it('retains the last successful statistics when a refresh fails', async () => {
    mocks.fetchAdminDashboardStats.mockResolvedValueOnce(stats).mockRejectedValueOnce(new Error('갱신 실패'));
    render(<AdminDashboard />);
    await screen.findByText('처리 완료 상태 신고');
    fireEvent.click(screen.getAllByRole('button', { name: '새로고침' })[0]);
    expect(await screen.findByText(/기존 현황을 유지했습니다/)).toHaveTextContent('갱신 실패');
    expect(screen.getByText('401')).toBeInTheDocument();
  });

  it('ignores an aborted StrictMode request after the replacement succeeds', async () => {
    const late = deferred<AdminDashboardStats>();
    mocks.fetchAdminDashboardStats.mockReturnValueOnce(late.promise).mockResolvedValueOnce({ ...stats, receivedReportsCount: 97 });
    render(<StrictMode><AdminDashboard /></StrictMode>);
    await screen.findByText('97');
    expect((mocks.fetchAdminDashboardStats.mock.calls[0][0] as AbortSignal).aborted).toBe(true);
    await act(async () => late.resolve({ ...stats, receivedReportsCount: 983 }));
    expect(screen.queryByText('983')).not.toBeInTheDocument();
    expect(screen.getByText('97')).toBeInTheDocument();
  });
});
