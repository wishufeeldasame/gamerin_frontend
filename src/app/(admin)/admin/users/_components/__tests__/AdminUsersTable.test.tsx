import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUserResponse } from '@/lib/admin-user-api';
import { deferred } from '@/test/fetch-routes';
import { AdminUsersTable } from '../AdminUsersTable';

const api = vi.hoisted(() => ({ fetchAdminUsers: vi.fn() }));
vi.mock('@/lib/admin-user-api', () => api);
const user: AdminUserResponse = {
  id: '00000000-0000-4000-8000-000000000001', handle: 'gamer', nickname: '사용자',
  email: 'user@example.test', profileImageUrl: null, role: 'USER', status: 'ACTIVE',
  createdAt: '2026-10-01T00:00:00Z', reportsReceivedCount: 2, activeSanction: '없음', activePenaltyId: null,
};
const page = (content = [user], number = 0) => ({ content, totalPages: 2, totalElements: 7, number, size: 6 });

describe('실제 API 기반 사용자 관리 목록', () => {
  beforeEach(() => { api.fetchAdminUsers.mockReset(); api.fetchAdminUsers.mockImplementation(async (params) => page([user], params.page)); });

  it('한국어 검색 안내와 서버의 사용자 DTO를 표시한다', async () => {
    render(<AdminUsersTable />);
    expect(screen.getByRole('searchbox', { name: '사용자 검색' })).toHaveAttribute('placeholder', '핸들 · 닉네임 검색');
    expect(await screen.findByText('@gamer')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '상세 보기' })).toHaveAttribute('href', '/admin/users/gamer');
    expect(screen.queryByText(/예시/)).not.toBeInTheDocument();
  });

  it('검색 시 서버 페이지를 초기화하고 탈퇴·제재 없음 필터를 전달한다', async () => {
    render(<AdminUsersTable />);
    await screen.findByText('@gamer');
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(api.fetchAdminUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }), expect.any(AbortSignal)));
    await screen.findByText('@gamer');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '미드킹' } });
    await waitFor(() => expect(api.fetchAdminUsers).toHaveBeenLastCalledWith(expect.objectContaining({ query: '미드킹', page: 0 }), expect.any(AbortSignal)));
    fireEvent.change(screen.getByRole('combobox', { name: '현재 상태 필터' }), { target: { value: 'DELETED' } });
    fireEvent.change(screen.getByRole('combobox', { name: '활성 제재 필터' }), { target: { value: 'false' } });
    await waitFor(() => expect(api.fetchAdminUsers).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'DELETED', hasSanction: false, page: 0 }), expect.any(AbortSignal)));
  });

  it('오류를 표시하고 재시도로 데이터를 조회한다', async () => {
    api.fetchAdminUsers.mockRejectedValueOnce(new Error('조회 실패'));
    render(<AdminUsersTable />);
    expect(await screen.findByText('조회 실패')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('@gamer')).toBeInTheDocument();
  });

  it('서버가 빈 Page를 반환하면 빈 상태와 실제 전체 수를 표시한다', async () => {
    api.fetchAdminUsers.mockResolvedValue({ content: [], totalPages: 0, totalElements: 0, number: 0, size: 6 });
    render(<AdminUsersTable />);
    expect(await screen.findByText('조건에 맞는 사용자가 없습니다.')).toBeInTheDocument();
    expect(screen.queryByText('@gamer')).not.toBeInTheDocument();
  });

  it('마지막 페이지가 사라지고 전체가 비면 첫 페이지로 돌아간다', async () => {
    render(<AdminUsersTable />);
    await screen.findByText('@gamer');
    api.fetchAdminUsers.mockResolvedValue({ content: [], totalPages: 0, totalElements: 0, number: 0, size: 6 });
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await screen.findByText('조건에 맞는 사용자가 없습니다.');
    expect(api.fetchAdminUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0 }), expect.any(AbortSignal));
    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled();
  });

  it('조건 변경 후 도착한 이전 응답을 버리고 이전 요청을 취소한다', async () => {
    const previous = deferred<ReturnType<typeof page>>();
    api.fetchAdminUsers.mockReturnValueOnce(previous.promise);
    render(<AdminUsersTable />);
    await waitFor(() => expect(api.fetchAdminUsers).toHaveBeenCalledTimes(1));
    const signal = api.fetchAdminUsers.mock.calls[0][1] as AbortSignal;
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '새 검색' } });
    await screen.findByText('@gamer');
    await act(async () => previous.resolve(page([{ ...user, handle: 'old-result' }])));
    expect(signal.aborted).toBe(true);
    expect(screen.queryByText('@old-result')).not.toBeInTheDocument();
  });
});
