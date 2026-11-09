import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { render } from '@/test/feedback';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connectR6: vi.fn().mockResolvedValue(undefined),
  connectValorant: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/app/context/AuthContext', () => ({ useAuth: () => ({ updateUser: vi.fn() }) }));
vi.mock('@/lib/game-stats-api', () => ({
  connectPubg: vi.fn(),
  connectR6: mocks.connectR6,
  connectValorant: mocks.connectValorant,
  fetchPubgSummary: vi.fn(),
  GameStatsApiError: class extends Error {},
}));

import { FetchGameStatsModal } from '../FetchGameStatsModal';

describe('FetchGameStatsModal', () => {
  it('이미 연동된 게임은 연동 완료로 표시하고 재연결을 막는다', () => {
    render(<FetchGameStatsModal onClose={vi.fn()} connectedGames={['LOL', 'PUBG', 'R6']} />);
    for (const name of ['League of Legends', 'PUBG', 'Rainbow Six Siege']) {
      const row = screen.getByRole('heading', { name }).closest('div.group') as HTMLElement;
      const button = within(row).getByRole('button', { name: '연동 완료' });
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    const valorant = screen.getByRole('heading', { name: 'VALORANT' }).closest('div.group') as HTMLElement;
    expect(within(valorant).getByRole('button', { name: '연결' })).toBeEnabled();
  });

  it('발로란트만 연동된 경우 LoL은 연결할 수 있다', () => {
    render(<FetchGameStatsModal onClose={vi.fn()} connectedGames={['VALORANT']} />);
    const valorant = screen.getByRole('heading', { name: 'VALORANT' }).closest('div.group') as HTMLElement;
    expect(within(valorant).getByRole('button', { name: '연동 완료' })).toBeDisabled();
    const lol = screen.getByRole('heading', { name: 'League of Legends' }).closest('div.group') as HTMLElement;
    expect(within(lol).getByRole('button', { name: '연결' })).toBeEnabled();
  });

  it('지원하지 않는 게임은 연결할 수 없다고 표시한다', () => {
    render(<FetchGameStatsModal onClose={vi.fn()} />);
    const row = screen.getByRole('heading', { name: 'Overwatch 2' }).closest('div.group') as HTMLElement;
    expect(within(row).getByRole('button', { name: '지원 예정' })).toBeDisabled();
  });

  it('Escape는 입력 폼을 먼저 닫고 다음에 전체 창을 닫는다', () => {
    const onClose = vi.fn();
    render(<FetchGameStatsModal onClose={onClose} />);
    const row = screen.getByRole('heading', { name: 'Rainbow Six Siege' }).closest('div.group') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: '연결' }));
    expect(screen.getByRole('textbox', { name: '게임 닉네임' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: '게임 닉네임' })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('동의 체크 없이 바로 게임 계정을 연결한다', async () => {
    render(<FetchGameStatsModal onClose={vi.fn()} />);
    const row = screen.getByRole('heading', { name: 'Rainbow Six Siege' }).closest('div.group') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: '연결' }));
    fireEvent.change(screen.getByPlaceholderText('Ubisoft Connect 닉네임을 입력하세요'), { target: { value: 'player' } });

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '연결' }).at(-1) as HTMLElement);

    await waitFor(() => expect(mocks.connectR6).toHaveBeenCalledWith('player'));
  });

  it('발로란트는 Riot ID와 선택한 리전으로 연결한다', async () => {
    render(<FetchGameStatsModal onClose={vi.fn()} />);
    const row = screen.getByRole('heading', { name: 'VALORANT' }).closest('div.group') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: '연결' }));

    const input = screen.getByLabelText('Riot ID');
    fireEvent.change(input, { target: { value: '요원' } });
    const submit = screen.getAllByRole('button', { name: '연결' }).at(-1) as HTMLElement;
    fireEvent.click(submit);
    expect(await screen.findByText(/닉네임#태그 형식/)).toBeInTheDocument();
    expect(mocks.connectValorant).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '요원#KR1' } });
    fireEvent.click(screen.getByLabelText('아시아·태평양 (AP)'));
    fireEvent.click(submit);

    await waitFor(() => expect(mocks.connectValorant).toHaveBeenCalledWith('요원#KR1', 'AP'));
  });
});
