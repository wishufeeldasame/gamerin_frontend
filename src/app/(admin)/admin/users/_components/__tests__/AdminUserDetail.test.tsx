import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUserResponse, UserPenaltyResponse } from '@/lib/admin-user-api';
import { deferred } from '@/test/fetch-routes';
import { AdminUserDetail } from '../AdminUserDetail';

const api = vi.hoisted(() => ({
  fetchAdminUserByHandle: vi.fn(), fetchAdminUser: vi.fn(), fetchAdminUserPenalties: vi.fn(),
  createAdminUserPenalty: vi.fn(), revokeAdminUserPenalty: vi.fn(),
}));
const auth = vi.hoisted(() => ({ user: { id: '00000000-0000-4000-8000-000000000099', role: 'ADMIN' }, isAuthReady: true, isLoggingOut: false }));
vi.mock('@/lib/admin-user-api', () => api);
vi.mock('@/app/context/AuthContext', () => ({ useAuth: () => auth }));

const user: AdminUserResponse = {
  id: '00000000-0000-4000-8000-000000000001', handle: 'gamer', nickname: '사용자',
  email: 'user@example.test', profileImageUrl: null, role: 'USER', status: 'ACTIVE',
  createdAt: '2026-10-01T00:00:00Z', reportsReceivedCount: 2, activeSanction: '경고',
  activePenaltyId: '00000000-0000-4000-8000-000000000002',
};
const penalty: UserPenaltyResponse = {
  id: '00000000-0000-4000-8000-000000000002', userId: user.id, userNickname: user.nickname,
  reportId: null, penaltyType: 'WARNING', reason: '운영 정책 안내', startAt: '2026-10-01T00:00:00Z',
  endAt: null, isActive: true, administeredByAdminId: auth.user.id,
  administeredByAdminNickname: '운영자', createdAt: '2026-10-01T00:00:00Z',
};
const page = (content = [penalty]) => ({ content, totalPages: content.length ? 1 : 0, totalElements: content.length, number: 0, size: 10 });
const load = async () => { render(<AdminUserDetail handle='gamer' />); await screen.findByText('@gamer · ' + user.id); };
const prepareSanction = (type = 'SUSPENSION_3D') => {
  fireEvent.change(screen.getByRole('combobox', { name: '제재 유형' }), { target: { value: type } });
  fireEvent.change(screen.getByRole('textbox', { name: '제재 사유' }), { target: { value: '  실제 제재 근거  ' } });
  fireEvent.click(screen.getByRole('button', { name: '조치 내용 확인' }));
};

describe('관리자 사용자 상세 실제 제재 흐름', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    auth.user = { id: '00000000-0000-4000-8000-000000000099', role: 'ADMIN' };
    auth.isAuthReady = true;
    auth.isLoggingOut = false;
    api.fetchAdminUserByHandle.mockResolvedValue(user);
    api.fetchAdminUser.mockResolvedValue(user);
    api.fetchAdminUserPenalties.mockResolvedValue(page());
    api.createAdminUserPenalty.mockResolvedValue(penalty);
    api.revokeAdminUserPenalty.mockResolvedValue({ ...penalty, isActive: false });
  });

  it('핸들로 실제 조회하고 null 종료일의 경고를 영구 정지로 표시하지 않는다', async () => {
    await load();
    expect(api.fetchAdminUserByHandle).toHaveBeenCalledWith('gamer', expect.any(AbortSignal));
    expect(screen.getByText(/경고 · 종료일 없음/)).toBeInTheDocument();
    expect(screen.queryByText('확인된 위반')).not.toBeInTheDocument();
    expect(screen.queryByText('RPT-1024')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '조치 내용 확인' })).toBeEnabled();
  });

  it('기존 인증 정책과 동일하게 ROLE_ADMIN 계정의 조치를 허용한다', async () => {
    auth.user = { ...auth.user, role: 'ROLE_ADMIN' };
    await load();
    expect(screen.getByRole('button', { name: '조치 내용 확인' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '선택한 제재 해제' })).toBeEnabled();
  });

  it.each([
    ['관리자', { ...user, role: 'ADMIN' as const }],
    ['본인', { ...user, id: '00000000-0000-4000-8000-000000000099' }],
    ['탈퇴', { ...user, status: 'DELETED' as const }],
  ])('%s 계정은 제재와 해제를 모두 비활성화한다', async (_kind, protectedUser) => {
    api.fetchAdminUserByHandle.mockResolvedValue(protectedUser);
    render(<AdminUserDetail handle='gamer' />);
    await screen.findByText('@gamer · ' + protectedUser.id);
    expect(screen.getByRole('combobox', { name: '제재 유형' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: '제재 사유' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '조치 내용 확인' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '선택한 제재 해제' })).toBeDisabled();
    expect(api.createAdminUserPenalty).not.toHaveBeenCalled();
    expect(api.revokeAdminUserPenalty).not.toHaveBeenCalled();
  });

  it('확인되지 않은 사용자 식별자로 제재할 수 없다', async () => {
    api.fetchAdminUserByHandle.mockResolvedValue({ ...user, id: 'unknown' });
    render(<AdminUserDetail handle='gamer' />);
    expect(await screen.findByText('사용자 식별자를 확인할 수 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '조치 내용 확인' })).not.toBeInTheDocument();
    expect(api.fetchAdminUserPenalties).not.toHaveBeenCalled();
  });

  it('사용자·이력 조회 실패를 표시하고 재시도한다', async () => {
    api.fetchAdminUserPenalties.mockRejectedValueOnce(new Error('제재 조회 실패'));
    render(<AdminUserDetail handle='gamer' />);
    await screen.findByText('제재 조회 실패');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await screen.findByText('@gamer · ' + user.id);
    expect(api.fetchAdminUserByHandle).toHaveBeenCalledTimes(2);
  });

  it('제재는 응답 UUID로 전송하고 확인 요청 중 중복 제출을 막는다', async () => {
    const pending = deferred<UserPenaltyResponse>();
    api.createAdminUserPenalty.mockReturnValueOnce(pending.promise);
    await load();
    prepareSanction();
    const button = within(screen.getByRole('dialog')).getByRole('button', { name: '제재 적용' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(api.createAdminUserPenalty).toHaveBeenCalledTimes(1);
    expect(api.createAdminUserPenalty).toHaveBeenCalledWith(user.id, { penaltyType: 'SUSPENSION_3D', reason: '실제 제재 근거', durationDays: 3 }, expect.any(AbortSignal));
    expect(screen.getByRole('button', { name: '처리 중…' })).toBeDisabled();
    await act(async () => pending.resolve(penalty));
    await screen.findByText('사용자 제재를 적용했습니다.');
    expect(api.fetchAdminUser).toHaveBeenCalledWith(user.id, expect.any(AbortSignal));
    expect(api.fetchAdminUserPenalties).toHaveBeenCalledTimes(2);
  });

  it('제재 거절 시 기존 상태와 입력을 보존하고 오류를 표시한다', async () => {
    api.createAdminUserPenalty.mockRejectedValueOnce(new Error('서버 보호 거절'));
    await load();
    prepareSanction('WARNING');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '제재 적용' }));
    await screen.findByText('서버 보호 거절');
    expect(screen.getAllByText('활성')).toHaveLength(2);
    expect(screen.getByRole('textbox', { name: '제재 사유' })).toHaveValue('  실제 제재 근거  ');
    expect(api.fetchAdminUser).not.toHaveBeenCalled();
  });

  it('선택한 활성 제재만 해제하고 남은 정지 상태를 서버 재조회로 유지한다', async () => {
    const first = { ...penalty, penaltyType: 'SUSPENSION_3D' as const, endAt: '2026-10-10T00:00:00Z', reason: '첫 번째 정지' };
    const second = { ...penalty, id: '00000000-0000-4000-8000-000000000003', penaltyType: 'SUSPENSION_7D' as const, endAt: '2026-10-14T00:00:00Z', reason: '두 번째 정지' };
    const suspended = { ...user, status: 'SUSPENDED' as const, activeSanction: '3일 정지' };
    api.fetchAdminUserByHandle.mockResolvedValue(suspended);
    api.fetchAdminUserPenalties.mockResolvedValueOnce(page([first, second])).mockResolvedValueOnce(page([{ ...first, isActive: false }, second]));
    api.fetchAdminUser.mockResolvedValue({ ...suspended, activeSanction: '7일 정지', activePenaltyId: second.id });
    await load();
    fireEvent.change(screen.getByRole('combobox', { name: '해제할 활성 제재' }), { target: { value: first.id } });
    fireEvent.click(screen.getByRole('button', { name: '선택한 제재 해제' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '제재 해제' }));
    await screen.findByText('선택한 제재를 해제했습니다.');
    expect(api.revokeAdminUserPenalty).toHaveBeenCalledExactlyOnceWith(user.id, first.id, expect.any(AbortSignal));
    expect(screen.getByText('정지')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '해제할 활성 제재' })).toHaveValue(second.id);
    expect(api.fetchAdminUserPenalties).toHaveBeenCalledTimes(2);
  });

  it('해제 실패 시 계정과 활성 제재를 변경하지 않는다', async () => {
    api.revokeAdminUserPenalty.mockRejectedValueOnce(new Error('해제 실패'));
    await load();
    fireEvent.click(screen.getByRole('button', { name: '선택한 제재 해제' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '제재 해제' }));
    await screen.findByText('해제 실패');
    expect(screen.getByRole('combobox', { name: '해제할 활성 제재' })).toHaveValue(penalty.id);
    expect(api.fetchAdminUser).not.toHaveBeenCalled();
  });

  it('조치 완료 후 재조회 실패 시 오래된 제재 화면을 비활성화하고 재시도를 제공한다', async () => {
    api.fetchAdminUser.mockRejectedValueOnce(new Error('재조회 실패'));
    await load();
    prepareSanction();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '제재 적용' }));
    await screen.findByText(/조치는 완료되었지만 최신 상태를 불러오지 못했습니다/);
    expect(screen.queryByRole('button', { name: '조치 내용 확인' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await screen.findByText('@gamer · ' + user.id);
    expect(api.createAdminUserPenalty).toHaveBeenCalledTimes(1);
  });

  it('핸들 변경 후 이전 응답은 표시하지 않는다', async () => {
    const pending = deferred<AdminUserResponse>();
    api.fetchAdminUserByHandle.mockReturnValueOnce(pending.promise).mockResolvedValueOnce({ ...user, handle: 'next-user', nickname: '다음 사용자' });
    const { rerender } = render(<AdminUserDetail handle='gamer' />);
    rerender(<AdminUserDetail handle='next-user' />);
    await screen.findByText('다음 사용자');
    await act(async () => pending.resolve(user));
    expect(screen.queryByText('@gamer · ' + user.id)).not.toBeInTheDocument();
  });

  it('관리자 인증 확인 전 조치를 비활성화한다', async () => {
    auth.isAuthReady = false;
    await load();
    expect(screen.getByRole('button', { name: '조치 내용 확인' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '선택한 제재 해제' })).toBeDisabled();
  });

  it('활성 제재가 없는 빈 이력에는 해제를 제공하지 않는다', async () => {
    api.fetchAdminUserPenalties.mockResolvedValue(page([]));
    await load();
    expect(screen.getByText('제재 이력이 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '선택한 제재 해제' })).toBeDisabled();
  });

  it('제재 요청 중 계정이 전환되면 요청을 취소하고 이전 성공을 표시하지 않는다', async () => {
    const pending = deferred<UserPenaltyResponse>();
    api.createAdminUserPenalty.mockReturnValueOnce(pending.promise);
    const { rerender } = render(<AdminUserDetail handle='gamer' />);
    await screen.findByText('@gamer · ' + user.id);
    prepareSanction();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '제재 적용' }));
    const signal = api.createAdminUserPenalty.mock.calls[0][2] as AbortSignal;
    auth.user = { id: '00000000-0000-4000-8000-000000000098', role: 'ADMIN' };
    rerender(<AdminUserDetail handle='gamer' />);
    await screen.findByText('@gamer · ' + user.id);
    await act(async () => pending.resolve(penalty));
    expect(signal.aborted).toBe(true);
    expect(api.fetchAdminUser).not.toHaveBeenCalled();
    expect(screen.queryByText('사용자 제재를 적용했습니다.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '조치 내용 확인' })).toBeEnabled();
  });
});
