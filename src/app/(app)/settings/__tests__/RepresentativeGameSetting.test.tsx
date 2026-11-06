import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/app/context/ToastContext';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1', handle: 'tester', representativeGame: null as string | null },
  updateUser: vi.fn(),
  fetchMyProfile: vi.fn(),
  fetchAuthUser: vi.fn(),
  updateRepresentativeGame: vi.fn(),
}));

vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user, updateUser: mocks.updateUser }),
}));
vi.mock('@/lib/feed-api', () => ({ fetchMyProfile: mocks.fetchMyProfile }));
vi.mock('@/lib/auth-api', () => ({ fetchAuthUser: mocks.fetchAuthUser }));
vi.mock('@/lib/game-stats-api', () => ({ updateRepresentativeGame: mocks.updateRepresentativeGame }));

import { RepresentativeGameSetting } from '../RepresentativeGameSetting';

function renderSetting() {
  return render(<ToastProvider><RepresentativeGameSetting /></ToastProvider>);
}

describe('RepresentativeGameSetting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.representativeGame = null;
    mocks.fetchMyProfile.mockResolvedValue({
      gameStats: { RIOT: { connected: true }, LOL: { connected: true, tierLabel: 'GOLD I' }, R6: { connected: false } },
    });
  });

  it('연동한 게임만 고를 수 있다', async () => {
    renderSetting();

    const lol = await screen.findByRole('radio', { name: '리그 오브 레전드' });
    await waitFor(() => expect(lol).toBeEnabled());
    // 발로란트는 Riot 연동과 별개로 VALORANT 키로 판단한다.
    expect(screen.getByRole('radio', { name: '발로란트 (연동 필요)' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'PUBG (연동 필요)' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: '레인보우 식스 시즈 (연동 필요)' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: '표시 안 함' })).toBeChecked();
  });

  it('발로란트는 자기 연동 상태로 고를 수 있다', async () => {
    mocks.fetchMyProfile.mockResolvedValue({ gameStats: { VALORANT: { connected: true, tierLabel: 'Gold 2' } } });
    renderSetting();

    const valorant = await screen.findByRole('radio', { name: '발로란트' });
    await waitFor(() => expect(valorant).toBeEnabled());
    expect(screen.getByRole('radio', { name: '리그 오브 레전드 (연동 필요)' })).toBeDisabled();
  });

  it('고른 게임을 저장하고 내 정보를 다시 읽어 반영한다', async () => {
    const tier = { game: 'LOL', tierLabel: 'GOLD I' };
    mocks.updateRepresentativeGame.mockResolvedValue(null);
    mocks.fetchAuthUser.mockResolvedValue({ representativeGame: 'LOL', representativeTier: tier });
    renderSetting();

    const lol = await screen.findByRole('radio', { name: '리그 오브 레전드' });
    await waitFor(() => expect(lol).toBeEnabled());
    fireEvent.click(lol);

    await waitFor(() =>
      expect(mocks.updateUser).toHaveBeenCalledWith({ representativeGame: 'LOL', representativeTier: tier }),
    );
    expect(mocks.updateRepresentativeGame).toHaveBeenCalledWith('LOL');
  });

  it('저장에 실패하면 서버 메시지를 알린다', async () => {
    mocks.user.representativeGame = 'LOL';
    mocks.updateRepresentativeGame.mockRejectedValue(new Error('연동한 게임만 대표 게임으로 설정할 수 있습니다.'));
    renderSetting();

    const none = screen.getByRole('radio', { name: '표시 안 함' });
    await waitFor(() => expect(none).toBeEnabled());
    fireEvent.click(none);

    expect(await screen.findByText('연동한 게임만 대표 게임으로 설정할 수 있습니다.')).toBeInTheDocument();
    expect(mocks.updateRepresentativeGame).toHaveBeenCalledWith(null);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
