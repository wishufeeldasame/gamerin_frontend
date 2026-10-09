import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminAuditLog, AdminAuditSearchParams } from '@/lib/admin-audit-api';
import type { PageResponse } from '@/types/api';
import { deferred } from '@/test/fetch-routes';

const mocks = vi.hoisted(() => ({ fetchAdminAuditLogs: vi.fn() }));
vi.mock('@/lib/admin-audit-api', () => mocks);
import { AdminAuditLogs } from '../AdminAuditLogs';

const log: AdminAuditLog = {
  id: 'log-a', adminId: 'admin-a', adminNickname: '실제 관리자', actionType: 'USER_WARNING',
  targetType: 'USER', targetId: 'user-a', details: null, requestId: null, createdAt: '2026-10-07T00:00:00Z',
};
function page(content: AdminAuditLog[], number = 0): PageResponse<AdminAuditLog> {
  return { content, number, size: 20, totalPages: 3, totalElements: 42 };
}

describe('AdminAuditLogs', () => {
  beforeEach(() => {
    mocks.fetchAdminAuditLogs.mockReset().mockImplementation((params: AdminAuditSearchParams) => Promise.resolve(page([log], params.page)));
  });

  it('shows server rows, supports server paging and filters an administrator by UUID', async () => {
    render(<AdminAuditLogs />);
    await screen.findByRole('button', { name: '실제 관리자' });
    expect(screen.getByText('정보 없음')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '전체 관리자' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(mocks.fetchAdminAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 20 }), expect.any(AbortSignal)));
    await screen.findByRole('button', { name: '실제 관리자' });
    fireEvent.click(screen.getByRole('button', { name: '실제 관리자' }));
    await waitFor(() => expect(mocks.fetchAdminAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ adminId: 'admin-a', page: 0 }), expect.any(AbortSignal)));
    fireEvent.click(screen.getByRole('button', { name: '관리자 필터 해제' }));
    await waitFor(() => expect(mocks.fetchAdminAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ adminId: undefined, page: 0 }), expect.any(AbortSignal)));
  });

  it('uses backend action and target codes instead of Korean labels as filters', async () => {
    render(<AdminAuditLogs />);
    await screen.findByText('log-a');
    fireEvent.change(screen.getByRole('combobox', { name: '전체 작업' }), { target: { value: 'USER_BAN' } });
    await waitFor(() => expect(mocks.fetchAdminAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ actionType: 'USER_BAN' }), expect.any(AbortSignal)));
    fireEvent.change(screen.getByRole('combobox', { name: '전체 대상' }), { target: { value: 'USER' } });
    await waitFor(() => expect(mocks.fetchAdminAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ actionType: 'USER_BAN', targetType: 'USER', page: 0 }), expect.any(AbortSignal)));
  });

  it('shows a failure with retry and a successful empty state', async () => {
    mocks.fetchAdminAuditLogs.mockRejectedValueOnce(new Error('작업 조회 실패')).mockResolvedValueOnce({ content: [], number: 0, size: 20, totalPages: 0, totalElements: 0 });
    render(<AdminAuditLogs />);
    expect(await screen.findByRole('alert')).toHaveTextContent('작업 조회 실패');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('조건에 맞는 작업 이력이 없습니다.')).toBeInTheDocument();
  });

  it('aborts and discards an older filter response', async () => {
    const late = deferred<PageResponse<AdminAuditLog>>();
    mocks.fetchAdminAuditLogs.mockReturnValueOnce(late.promise).mockResolvedValueOnce(page([{ ...log, id: 'latest-log' }]));
    render(<AdminAuditLogs />);
    fireEvent.change(screen.getByRole('combobox', { name: '전체 작업' }), { target: { value: 'USER_BAN' } });
    await screen.findByText('latest-log');
    expect((mocks.fetchAdminAuditLogs.mock.calls[0][1] as AbortSignal).aborted).toBe(true);
    await act(async () => late.resolve(page([log])));
    expect(screen.queryByText('log-a')).not.toBeInTheDocument();
  });
});
