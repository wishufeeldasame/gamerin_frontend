import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const membershipApi = vi.hoisted(() => ({ fetchMyMembership: vi.fn(), fetchMyWeeklyReport: vi.fn() }));
const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: vi.fn() }));
const reportView = vi.hoisted(() => ({ path: '/membership/content-preview', userId: 'member', member: false }));
const loginPrompt = vi.hoisted(() => ({ requestLogin: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => navigation, usePathname: () => reportView.path }));
vi.mock('@/app/context/AuthContext', () => ({ useAuth: () => ({ user: { id: reportView.userId, membershipBadge: reportView.member }, isAuthReady: true }) }));
vi.mock('@/lib/history-back', () => ({ canGoBack: navigation.canGoBack }));
vi.mock('@/lib/membership-api', () => membershipApi);
vi.mock('@/lib/login-prompt', () => loginPrompt);

import MembershipContentPage from '../page';
import { MEMBERSHIP_CONTENT } from '@/lib/membership-content';
import { ApiError } from '@/lib/api-client';
import { deferred } from '@/test/fetch-routes';
import type { WeeklyGameReport } from '@/lib/membership-content';

describe('MembershipContentPage', () => {
  it('누락 안내를 쉽게 표시하고 상세가 없어도 경기 없음으로 단정하지 않는다', () => {
    const report = MEMBERSHIP_CONTENT.weeklyReport;
    const savedNotice = report.notice;
    const savedGames = report.games;
    try {
      report.notice = '일부 경기 정보를 불러오지 못했어요. 확인된 경기만으로 작성해 실제 기록과 차이가 있을 수 있어요.';
      report.games = [];
      render(<MembershipContentPage />);
      expect(screen.getByRole('status')).toHaveTextContent(report.notice);
      expect(screen.getByText('불러올 수 있는 경기 기록이 없습니다.')).toBeInTheDocument();
      expect(screen.queryByText('해당 기간의 플레이 기록이 없습니다.')).not.toBeInTheDocument();
      expect(screen.queryByText(/HTTP 404|HenrikDev|경기 ID/)).not.toBeInTheDocument();
    } finally {
      report.notice = savedNotice;
      report.games = savedGames;
    }
  });

  beforeEach(() => {
    Object.values(navigation).forEach((mock) => mock.mockReset());
    membershipApi.fetchMyMembership.mockReset();
    membershipApi.fetchMyWeeklyReport.mockReset();
    loginPrompt.requestLogin.mockReset();
    reportView.path = '/membership/content-preview';
    reportView.userId = 'member';
    reportView.member = false;
  });

  it('멤버십 조회 없이 고정 전적과 패치노트만 미리보기로 보여준다', () => {
    render(<MembershipContentPage />);
    expect(screen.getByRole('heading', { name: '주간 전적 요약' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '패치노트 요약' })).toBeInTheDocument();
    expect(screen.getByText(/예시 데이터입니다/)).toBeInTheDocument();
    for (const note of MEMBERSHIP_CONTENT.patchNotes) {
      expect(screen.getByRole('heading', { name: note.title })).toBeInTheDocument();
    }
    expect(screen.queryByText('고화질 업로드')).not.toBeInTheDocument();
    expect(screen.queryByText('광고 제거')).not.toBeInTheDocument();
    expect(membershipApi.fetchMyMembership).not.toHaveBeenCalled();
    expect(membershipApi.fetchMyWeeklyReport).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: '멤버십으로 돌아가기' })).toHaveAttribute('href', '/membership');
  });

  it('공식 패치노트의 버전·게시일·원문 링크와 배포 미확인 안내를 표시한다', () => {
    render(<MembershipContentPage />);
    for (const note of MEMBERSHIP_CONTENT.patchNotes) {
      expect(screen.getByText(note.version)).toBeInTheDocument();
      expect(screen.getAllByText(`게시 ${note.publishedAt}`).length).toBeGreaterThan(0);
      const link = screen.getByRole('link', { name: `${note.gameLabel} 공식 패치노트 원문 (새 탭)` });
      expect(link).toHaveAttribute('href', note.sourceUrl);
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    expect(screen.getByText('2026.11.10 기준 · PC 패치 · 공식 발표 요약')).toBeInTheDocument();
  });

  const statsOf = (gameLabel: string) => {
    const heading = screen.getByRole('heading', { name: gameLabel });
    return within(document.querySelector<HTMLElement>(`dl[aria-labelledby="${heading.id}"]`)!);
  };
  const statOf = (gameLabel: string, label: string) => within(statsOf(gameLabel).getByText(label).parentElement!);

  it('게임별 지난주·이번 주와 증감·동일을 비교한다', () => {
    render(<MembershipContentPage />);
    const winRate = statOf('리그 오브 레전드', '승률');
    expect(winRate.getByText('지난주 50%')).toBeInTheDocument();
    expect(winRate.getByText('58.3%')).toBeInTheDocument();
    expect(winRate.getByText('+8.3%p')).toBeInTheDocument();
    expect(statsOf('리그 오브 레전드').getByText('+4경기')).toBeInTheDocument();
    expect(statsOf('리그 오브 레전드').getByText('+0.3')).toBeInTheDocument();
    expect(statsOf('발로란트').getByText('-6.3%p')).toBeInTheDocument();
    expect(statsOf('발로란트').getByText('-0.2')).toBeInTheDocument();
    expect(statsOf('PUBG').getAllByText('동일')).toHaveLength(2);
    const lolCard = within(screen.getByRole('heading', { name: '리그 오브 레전드' }).closest('li')!);
    expect(lolCard.getByText('골드 3')).toBeInTheDocument();
    expect(lolCard.getByText('골드 2')).toBeInTheDocument();
    const valorantCard = within(screen.getByRole('heading', { name: '발로란트' }).closest('li')!);
    expect(valorantCard.getByText('유지')).toBeInTheDocument();
  });

  it('발로란트를 먼저 보여주고 HS% 비교와 게임별 분석 리포트를 표시한다', () => {
    render(<MembershipContentPage />);
    expect(screen.getAllByRole('heading', { level: 3 })[0]).toHaveTextContent('발로란트');
    const headshot = statOf('발로란트', '헤드샷(HS%)');
    expect(headshot.getByText('지난주 22.1%')).toBeInTheDocument();
    expect(headshot.getByText('24.6%')).toBeInTheDocument();
    expect(headshot.getByText('+2.5%p')).toBeInTheDocument();
    for (const game of MEMBERSHIP_CONTENT.weeklyReport.games) {
      expect(screen.getByRole('heading', { name: game.analysis.headline })).toBeInTheDocument();
      expect(screen.getByText(game.analysis.summary)).toBeInTheDocument();
      expect(screen.getByText(game.analysis.focus)).toBeInTheDocument();
    }
    expect(screen.getAllByRole('heading', { name: '다음 주 체크 포인트' })).toHaveLength(3);
    expect(statsOf('리그 오브 레전드').queryByText('헤드샷(HS%)')).not.toBeInTheDocument();
  });

  it('지난주 기록과 K/D가 없으면 증감을 만들지 않는다', () => {
    const game = MEMBERSHIP_CONTENT.weeklyReport.games.find((item) => item.game === 'LOL')!;
    const previous = game.previousWeek;
    const kd = game.kd;
    try {
      game.previousWeek = null;
      game.kd = null;
      render(<MembershipContentPage />);
      const stats = statsOf(game.gameLabel);
      expect(stats.getAllByText('비교 없음')).toHaveLength(3);
      expect(stats.queryByText(/지난주/)).not.toBeInTheDocument();
      expect(stats.getAllByText('—')).toHaveLength(1);
    } finally {
      game.previousWeek = previous;
      game.kd = kd;
    }
  });

  it('예시 화면에서 내 리포트 링크는 멤버십 회원에게만 보인다', () => {
    const view = render(<MembershipContentPage />);
    expect(screen.queryByRole('link', { name: '내 주간 리포트 보기' })).not.toBeInTheDocument();
    view.unmount();

    reportView.member = true;
    render(<MembershipContentPage />);
    expect(screen.getByRole('link', { name: '내 주간 리포트 보기' })).toHaveAttribute('href', '/membership/content');
  });

  it.each([true, false])('뒤로는 이전 기록(%s)에 따라 이동한다', async (hasHistory) => {
    navigation.canGoBack.mockReturnValue(hasHistory);
    render(<MembershipContentPage />);
    await userEvent.click(screen.getByRole('button', { name: '뒤로' }));
    if (hasHistory) expect(navigation.back).toHaveBeenCalledOnce();
    else expect(navigation.replace).toHaveBeenCalledWith('/membership');
  });

  it('준비된 데이터가 없으면 빈 상태를 표시한다', () => {
    const notes = MEMBERSHIP_CONTENT.patchNotes;
    const games = MEMBERSHIP_CONTENT.weeklyReport.games;
    try {
      MEMBERSHIP_CONTENT.patchNotes = [];
      MEMBERSHIP_CONTENT.weeklyReport.games = [];
      render(<MembershipContentPage />);
      expect(screen.getByText('해당 기간의 플레이 기록이 없습니다.')).toBeInTheDocument();
      expect(screen.getByText('아직 요약된 패치노트가 없습니다.')).toBeInTheDocument();
    } finally {
      MEMBERSHIP_CONTENT.patchNotes = notes;
      MEMBERSHIP_CONTENT.weeklyReport.games = games;
    }
  });

  it('실제 조회 중에 예시 전적을 보여주지 않고 서버 리포트와 누락 안내를 표시한다', async () => {
    reportView.path = '/membership/content';
    const pending = deferred<WeeklyGameReport>();
    membershipApi.fetchMyWeeklyReport.mockReturnValue(pending.promise);
    render(<MembershipContentPage />);
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중');
    expect(screen.queryByText(/예시 데이터입니다/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '발로란트' })).not.toBeInTheDocument();
    const report: WeeklyGameReport = {
      ...MEMBERSHIP_CONTENT.weeklyReport, totalMatches: 4,
      games: [{ ...MEMBERSHIP_CONTENT.weeklyReport.games[0], matches: 4, previousWeek: null }],
      notice: '일부 경기 정보를 불러오지 못했어요. 확인된 경기만으로 작성해 실제 기록과 차이가 있을 수 있어요.',
    };

    await act(async () => pending.resolve(report));

    expect(screen.getByRole('status')).toHaveTextContent(report.notice!);
    expect(screen.getByText('확인된 경기', { exact: true })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '발로란트' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '리그 오브 레전드' })).not.toBeInTheDocument();
    expect(membershipApi.fetchMyWeeklyReport).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(screen.getByRole('link', { name: '예시 리포트 미리보기' })).toHaveAttribute('href', '/membership/content-preview');
  });

  it('403이면 예시로 대체하지 않고 멤버십 안내를 표시한다', async () => {
    reportView.path = '/membership/content';
    membershipApi.fetchMyWeeklyReport.mockRejectedValue(new ApiError('멤버십 전용 콘텐츠입니다.', 403));
    render(<MembershipContentPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('멤버십 이용 중');
    expect(screen.getByRole('link', { name: '멤버십 안내 보기' })).toHaveAttribute('href', '/membership');
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '패치노트 요약' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '발로란트' })).not.toBeInTheDocument();
  });

  it('게스트에게 로그인 안내를 표시하고 개인 리포트를 요청하지 않는다', async () => {
    reportView.path = '/membership/content';
    reportView.userId = '';
    render(<MembershipContentPage />);
    expect(screen.getByText('로그인하면 내 주간 리포트를 확인할 수 있어요.')).toBeInTheDocument();
    expect(membershipApi.fetchMyWeeklyReport).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '로그인하고 확인하기' }));
    expect(loginPrompt.requestLogin).toHaveBeenCalledWith({ returnTo: '/membership/content' });
  });

  it('조회 실패를 재시도하고 빈 리포트에 플레이 기록 없음 안내를 표시한다', async () => {
    reportView.path = '/membership/content';
    membershipApi.fetchMyWeeklyReport.mockRejectedValueOnce(new ApiError('리포트 조회 실패', 503))
      .mockResolvedValueOnce({ ...MEMBERSHIP_CONTENT.weeklyReport, totalMatches: 0, games: [] });
    render(<MembershipContentPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('리포트 조회 실패');
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('해당 기간의 플레이 기록이 없습니다.')).toBeInTheDocument();
  });

  it('계정이 바뀌면 이전 계정 리포트를 숨기고 새 요청을 보내며 화면 이탈 시 중단한다', async () => {
    reportView.path = '/membership/content';
    const pending = deferred<WeeklyGameReport>();
    membershipApi.fetchMyWeeklyReport.mockResolvedValueOnce(MEMBERSHIP_CONTENT.weeklyReport)
      .mockReturnValueOnce(pending.promise);
    const view = render(<MembershipContentPage />);
    await screen.findByRole('heading', { name: '발로란트' });
    reportView.userId = 'another-member';
    view.rerender(<MembershipContentPage />);
    expect(screen.queryByRole('heading', { name: '발로란트' })).not.toBeInTheDocument();
    const signal = membershipApi.fetchMyWeeklyReport.mock.calls[1][0] as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(MEMBERSHIP_CONTENT.weeklyReport));
  });
});
