import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { AdminSettingApiItem } from '@/lib/admin-settings-api';
import { changedSettings, settingsFromApi } from '../../_data/settings';

const settingsApi = vi.hoisted(() => ({ fetchAdminSettings: vi.fn(), updateAdminSettings: vi.fn() }));
vi.mock('@/lib/admin-settings-api', () => settingsApi);
vi.mock('@/app/(admin)/admin/_components/AdminShell', () => ({
  AdminShell: ({ children, headerActions }: { children: ReactNode; headerActions: ReactNode }) => <div>{headerActions}{children}</div>,
}));

import { AdminSettingsScreen } from '../AdminSettingsScreen';

function configs(overrides: Record<string, string> = {}): AdminSettingApiItem[] {
  return Object.entries({
    AUTO_HIDE_ENABLED: 'true',
    AUTO_HIDE_THRESHOLD: '5',
    NEW_REPORT_ALERT: 'false',
    DEFAULT_SANCTION_LEVEL: 'WARNING',
    RE_REVIEW_DEADLINE_DAYS: '7',
    ...overrides,
  }).map(([configKey, configValue]) => ({ configKey, configValue, description: null, updatedAt: '2026-10-07T00:00:00Z' }));
}

describe('AdminSettingsScreen', () => {
  beforeEach(() => {
    settingsApi.fetchAdminSettings.mockReset().mockResolvedValue(configs());
    settingsApi.updateAdminSettings.mockReset().mockResolvedValue(configs());
  });

  it('initializes from the server, handles false correctly and only exposes supported settings', async () => {
    settingsApi.fetchAdminSettings.mockResolvedValue(configs({ AUTO_HIDE_ENABLED: 'false' }));
    render(<AdminSettingsScreen />);
    expect(screen.getByText('데이터를 불러오는 중입니다.')).toBeInTheDocument();
    expect(await screen.findByRole('switch', { name: '신고 누적 시 자동 숨김' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: '새 신고 접수 알림' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByLabelText('기본 제재 수준')).toHaveValue('warning');
    expect(screen.getByRole('button', { name: '변경사항 저장' })).toBeDisabled();
    expect(screen.queryByLabelText('서비스 이름')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: '관리자 2단계 인증 필수' })).not.toBeInTheDocument();
    expect(screen.getByText(/저장해도 알림 발송/)).toBeInTheDocument();
  });

  it('PUTs only changed keys and resets both draft and revert baseline from the complete response', async () => {
    settingsApi.updateAdminSettings.mockResolvedValue(configs({ AUTO_HIDE_ENABLED: 'false', DEFAULT_SANCTION_LEVEL: 'SUSPENSION_3D', AUTO_HIDE_THRESHOLD: '8' }));
    render(<AdminSettingsScreen />);
    fireEvent.click(await screen.findByRole('switch', { name: '신고 누적 시 자동 숨김' }));
    fireEvent.change(screen.getByLabelText('기본 제재 수준'), { target: { value: '3-days' } });
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }));

    await waitFor(() => expect(settingsApi.updateAdminSettings).toHaveBeenCalledWith({ AUTO_HIDE_ENABLED: 'false', DEFAULT_SANCTION_LEVEL: 'SUSPENSION_3D' }, expect.any(AbortSignal)));
    await waitFor(() => expect(screen.getByRole('button', { name: '변경사항 저장' })).toBeDisabled());
    expect(screen.getByLabelText('자동 숨김 임계값 (신고 수)')).toHaveValue(8);
    fireEvent.change(screen.getByLabelText('자동 숨김 임계값 (신고 수)'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    expect(screen.getByLabelText('자동 숨김 임계값 (신고 수)')).toHaveValue(8);
    expect(screen.getByLabelText('기본 제재 수준')).toHaveValue('3-days');
  });

  it('preserves input after a failed save and allows retry', async () => {
    settingsApi.updateAdminSettings.mockRejectedValueOnce(new Error('저장 실패')).mockResolvedValueOnce(configs({ AUTO_HIDE_THRESHOLD: '9' }));
    render(<AdminSettingsScreen />);
    fireEvent.change(await screen.findByLabelText('자동 숨김 임계값 (신고 수)'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('저장 실패');
    expect(screen.getByLabelText('자동 숨김 임계값 (신고 수)')).toHaveValue(9);
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }));
    await waitFor(() => expect(settingsApi.updateAdminSettings).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: '변경사항 저장' })).toBeDisabled());
  });

  it('locks duplicate saves and input while the request is pending', async () => {
    let resolve!: (value: AdminSettingApiItem[]) => void;
    settingsApi.updateAdminSettings.mockReturnValue(new Promise<AdminSettingApiItem[]>((done) => { resolve = done; }));
    render(<AdminSettingsScreen />);
    fireEvent.click(await screen.findByRole('switch', { name: '신고 누적 시 자동 숨김' }));
    const save = screen.getByRole('button', { name: '변경사항 저장' });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(settingsApi.updateAdminSettings).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '저장 중…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '되돌리기' })).toBeDisabled();
    expect(screen.getByLabelText('자동 숨김 임계값 (신고 수)')).toBeDisabled();
    resolve(configs({ AUTO_HIDE_ENABLED: 'false' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '변경사항 저장' })).toBeDisabled());
  });

  it.each(['0', '1.5', ''])('rejects an invalid positive integer %s before writing', async (value) => {
    render(<AdminSettingsScreen />);
    fireEvent.change(await screen.findByLabelText('신고 재검토 기한 (일)'), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('1 이상의 정수');
    expect(settingsApi.updateAdminSettings).not.toHaveBeenCalled();
  });

  it('retries a failed GET without displaying local defaults', async () => {
    settingsApi.fetchAdminSettings.mockRejectedValueOnce(new Error('조회 실패')).mockResolvedValueOnce(configs());
    render(<AdminSettingsScreen />);
    expect(await screen.findByRole('alert')).toHaveTextContent('조회 실패');
    expect(screen.queryByLabelText('기본 제재 수준')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByLabelText('기본 제재 수준')).toHaveValue('warning');
  });

  it('does not replace a missing registered key with a dummy value', async () => {
    settingsApi.fetchAdminSettings.mockResolvedValue(configs().filter((item) => item.configKey !== 'AUTO_HIDE_THRESHOLD'));
    render(<AdminSettingsScreen />);
    expect(await screen.findByRole('alert')).toHaveTextContent('AUTO_HIDE_THRESHOLD');
    expect(screen.queryByLabelText('자동 숨김 임계값 (신고 수)')).not.toBeInTheDocument();
  });

  it('explicitly round-trips warning, 3-day sanction and string false', () => {
    const baseline = settingsFromApi(configs({ AUTO_HIDE_ENABLED: 'false', DEFAULT_SANCTION_LEVEL: 'SUSPENSION_3D' }));
    expect(baseline).toMatchObject({ autoHideReports: false, newReportNotification: false, defaultSanction: '3-days' });
    expect(changedSettings({ ...baseline, defaultSanction: 'warning', newReportNotification: true }, baseline)).toEqual({ DEFAULT_SANCTION_LEVEL: 'WARNING', NEW_REPORT_ALERT: 'true' });
  });
});
