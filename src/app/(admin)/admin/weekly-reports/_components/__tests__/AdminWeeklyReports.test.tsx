import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import type { WeeklyGameReport } from '@/lib/membership-content';
import { deferred } from '@/test/fetch-routes';

const api = vi.hoisted(() => ({ generateAdminValorantWeeklyReport: vi.fn() }));
vi.mock('@/lib/admin-weekly-report-api', () => api);
vi.mock('@/app/(admin)/admin/_components/AdminShell', () => ({
  AdminShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { AdminWeeklyReports } from '../AdminWeeklyReports';

const report: WeeklyGameReport = {
  weekStart: '2026-11-02', weekEnd: '2026-11-08',
  previousWeekStart: '2026-10-26', previousWeekEnd: '2026-11-01',
  totalMatches: 1,
  games: [{
    game: 'VALORANT', gameLabel: '발로란트', matches: 1, winRate: 100,
    kd: null, headshotRate: null, tierLabel: null, previousWeek: null,
    analysis: { headline: '분석 제목', summary: '주간 요약', focus: '다음 주 점검' },
  }],
};

function submit(name = '플레이어#KR1') {
  fireEvent.change(screen.getByLabelText('닉네임 (이름#태그)'), { target: { value: name } });
  fireEvent.submit(screen.getByRole('button', { name: '실행 · 리포트 생성' }).closest('form')!);
}

describe('AdminWeeklyReports', () => {
  beforeEach(() => {
    api.generateAdminValorantWeeklyReport.mockReset().mockResolvedValue(report);
  });

  it('submits the selected region and trimmed Riot ID once, then displays nullable JSON', async () => {
    const pending = deferred<WeeklyGameReport>();
    api.generateAdminValorantWeeklyReport.mockReturnValue(pending.promise);
    render(<AdminWeeklyReports />);
    expect(api.generateAdminValorantWeeklyReport).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('리전'), { target: { value: 'AP' } });
    submit('  플레이어#TAG  ');
    fireEvent.submit(screen.getByRole('button', { name: '생성 중...' }).closest('form')!);

    expect(api.generateAdminValorantWeeklyReport).toHaveBeenCalledExactlyOnceWith('플레이어#TAG', 'AP', expect.any(AbortSignal));
    expect(screen.getByRole('button', { name: '생성 중...' })).toBeDisabled();
    expect(screen.getByLabelText('리전')).toBeDisabled();
    expect(screen.getByLabelText('닉네임 (이름#태그)')).toBeDisabled();
    expect(screen.getByText('리포트를 생성하고 있습니다.')).toBeInTheDocument();

    await act(async () => pending.resolve(report));
    expect(screen.getByText('HTTP 200')).toBeInTheDocument();
    expect(JSON.parse(screen.getByLabelText('응답 JSON').textContent!)).toEqual(report);
    expect(screen.getByRole('button', { name: '실행 · 리포트 생성' })).toBeEnabled();
  });

  it.each(['', '플레이어', '#KR1', '플레이어#', '플레이어#태그#추가', `${'a'.repeat(30)}#TAG`])(
    'rejects malformed Riot ID %s before calling the endpoint', async (name) => {
      render(<AdminWeeklyReports />);
      submit(name);
      expect(await screen.findByRole('alert')).toHaveTextContent('이름#태그');
      expect(api.generateAdminValorantWeeklyReport).not.toHaveBeenCalled();
    },
  );

  it('requires a supported region', async () => {
    render(<AdminWeeklyReports />);
    fireEvent.change(screen.getByLabelText('리전'), { target: { value: '' } });
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('리전을 선택');
    expect(api.generateAdminValorantWeeklyReport).not.toHaveBeenCalled();
  });

  it('shows the server status and message, preserves input and allows an explicit retry', async () => {
    api.generateAdminValorantWeeklyReport
      .mockRejectedValueOnce(new ApiError('잠시 후 다시 시도해 주세요.', 429))
      .mockResolvedValueOnce({ ...report, totalMatches: 0, games: [] });
    render(<AdminWeeklyReports />);
    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('잠시 후 다시 시도해 주세요.');
    expect(screen.getByText('HTTP 429')).toBeInTheDocument();
    expect(screen.getByLabelText('닉네임 (이름#태그)')).toHaveValue('플레이어#KR1');
    expect(api.generateAdminValorantWeeklyReport).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '실행 · 리포트 생성' }));

    expect(await screen.findByText('생성이 완료되었습니다. 대상 주의 경쟁전 기록이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(JSON.parse(screen.getByLabelText('응답 JSON').textContent!).games).toEqual([]);
  });

  it('aborts the browser request when leaving the page', async () => {
    const pending = deferred<WeeklyGameReport>();
    api.generateAdminValorantWeeklyReport.mockReturnValue(pending.promise);
    const { unmount } = render(<AdminWeeklyReports />);
    submit();
    const signal = api.generateAdminValorantWeeklyReport.mock.calls[0][2] as AbortSignal;

    unmount();

    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(report));
    await waitFor(() => expect(screen.queryByLabelText('응답 JSON')).not.toBeInTheDocument());
  });

  it('keeps the partial report and explains missing details to the administrator', async () => {
    api.generateAdminValorantWeeklyReport.mockResolvedValue({
      ...report,
      notice: '일부 경기 정보를 불러오지 못했어요. 확인된 경기만으로 작성해 실제 기록과 차이가 있을 수 있어요.',
      collectionIssues: [{
        matchId: 'missing-match', startedAt: '2026-11-02T15:27:02.659Z', map: 'Lotus', httpStatus: 404,
        reason: '랭크 이력에는 있지만 HenrikDev 경기 상세 API에서 경기 정보를 찾을 수 없습니다.',
      }],
    });
    render(<AdminWeeklyReports />);
    submit();

    expect(await screen.findByText('경기 수집 안내')).toBeInTheDocument();
    expect(screen.getByText(/Lotus · HTTP 404/)).toBeInTheDocument();
    expect(screen.getByText('경기 ID: missing-match')).toBeInTheDocument();
    expect(screen.getByText(/최근 최대 20건/)).toBeInTheDocument();
    expect(screen.getByText('HTTP 200')).toBeInTheDocument();
    expect(JSON.parse(screen.getByLabelText('응답 JSON').textContent!).games).toEqual(report.games);
  });
});
