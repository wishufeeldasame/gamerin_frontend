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
