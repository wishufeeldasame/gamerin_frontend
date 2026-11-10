import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const membershipApi = vi.hoisted(() => ({ fetchMyMembership: vi.fn() }));
const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
vi.mock('@/lib/history-back', () => ({ canGoBack: navigation.canGoBack }));
vi.mock('@/lib/membership-api', () => membershipApi);

import MembershipContentPage from '../page';
import { MEMBERSHIP_CONTENT } from '@/lib/membership-content';

describe('MembershipContentPage', () => {
  beforeEach(() => {
    Object.values(navigation).forEach((mock) => mock.mockReset());
    membershipApi.fetchMyMembership.mockReset();
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
    expect(screen.getByText(/실제 배포 완료 여부 확인 필요/)).toBeInTheDocument();
    expect(screen.getByText('2026.11.10 기준 · PC 패치 · 공식 발표 요약')).toBeInTheDocument();
  });

  it('게임별 지난주·이번 주와 증감·동일을 비교한다', () => {
    render(<MembershipContentPage />);
    const lol = within(screen.getByRole('table', { name: '리그 오브 레전드' }));
    const winRate = within(lol.getByRole('row', { name: /승률/ }));
    expect(winRate.getByText('50%')).toBeInTheDocument();
    expect(winRate.getByText('58.3%')).toBeInTheDocument();
    expect(winRate.getByText('+8.3%p')).toBeInTheDocument();
    expect(lol.getByText('+4경기')).toBeInTheDocument();
    expect(lol.getByText('+0.3')).toBeInTheDocument();
    const valorant = within(screen.getByRole('table', { name: '발로란트' }));
    expect(valorant.getByText('-6.3%p')).toBeInTheDocument();
    expect(valorant.getByText('-0.2')).toBeInTheDocument();
    const pubg = within(screen.getByRole('table', { name: 'PUBG' }));
    expect(pubg.getAllByText('동일')).toHaveLength(2);
    expect(screen.getByText('지난주 골드 3')).toBeInTheDocument();
    expect(screen.getByText('이번 주 골드 2')).toBeInTheDocument();
  });

  it('발로란트를 먼저 보여주고 HS% 비교와 게임별 분석 리포트를 표시한다', () => {
    render(<MembershipContentPage />);
    expect(screen.getAllByRole('table')[0]).toHaveAccessibleName('발로란트');
    const valorant = within(screen.getByRole('table', { name: '발로란트' }));
    const headshot = within(valorant.getByRole('row', { name: /HS%/ }));
    expect(headshot.getByText('22.1%')).toBeInTheDocument();
    expect(headshot.getByText('24.6%')).toBeInTheDocument();
    expect(headshot.getByText('+2.5%p')).toBeInTheDocument();
    expect(screen.getByText('AI 분석 형식의 예시 리포트입니다.')).toBeInTheDocument();
    for (const game of MEMBERSHIP_CONTENT.weeklyReport.games) {
      expect(screen.getByRole('heading', { name: game.analysis.headline })).toBeInTheDocument();
      expect(screen.getByText(game.analysis.summary)).toBeInTheDocument();
      expect(screen.getByText(game.analysis.focus)).toBeInTheDocument();
    }
    expect(screen.getAllByRole('heading', { name: '다음 주 체크 포인트' })).toHaveLength(3);
    expect(within(screen.getByRole('table', { name: '리그 오브 레전드' })).queryByRole('row', { name: /HS%/ })).not.toBeInTheDocument();
  });

  it('지난주 기록과 K/D가 없으면 증감을 만들지 않는다', () => {
    const game = MEMBERSHIP_CONTENT.weeklyReport.games.find((item) => item.game === 'LOL')!;
    const previous = game.previousWeek;
    const kd = game.kd;
    try {
      game.previousWeek = null;
      game.kd = null;
      render(<MembershipContentPage />);
      const table = within(screen.getByRole('table', { name: game.gameLabel }));
      expect(table.getAllByText('비교 없음')).toHaveLength(3);
      expect(table.getAllByText('—')).toHaveLength(4);
      expect(screen.getByText('지난주 기록이 없어 비교할 수 없습니다.')).toBeInTheDocument();
    } finally {
      game.previousWeek = previous;
      game.kd = kd;
    }
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
      expect(screen.getByText('이번 주 플레이 기록이 없습니다.')).toBeInTheDocument();
      expect(screen.getByText('아직 요약된 패치노트가 없습니다.')).toBeInTheDocument();
    } finally {
      MEMBERSHIP_CONTENT.patchNotes = notes;
      MEMBERSHIP_CONTENT.weeklyReport.games = games;
    }
  });
});
