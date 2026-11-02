import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { render } from '@/test/feedback';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ connectR6: vi.fn().mockResolvedValue(undefined) }));

vi.mock('@/app/context/AuthContext', () => ({ useAuth: () => ({ updateUser: vi.fn() }) }));
vi.mock('@/lib/game-stats-api', () => ({
  connectPubg: vi.fn(),
  connectR6: mocks.connectR6,
  fetchPubgSummary: vi.fn(),
  GameStatsApiError: class extends Error {},
}));

import { FetchGameStatsModal } from '../FetchGameStatsModal';

describe('FetchGameStatsModal', () => {
  it('국외 전송에 동의해야 게임 계정을 연결할 수 있다', async () => {
    render(<FetchGameStatsModal onClose={vi.fn()} />);
    const row = screen.getByRole('heading', { name: 'Rainbow Six Siege' }).closest('div.group') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: '연결' }));
    fireEvent.change(screen.getByPlaceholderText('Ubisoft Connect 닉네임을 입력하세요'), { target: { value: 'player' } });

    const submit = screen.getAllByRole('button', { name: '연결' }).at(-1) as HTMLElement;
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/r6data\.com/));
    fireEvent.click(submit);

    await waitFor(() => expect(mocks.connectR6).toHaveBeenCalledWith('player'));
  });
});
