'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { useToast } from '@/app/context/ToastContext';
import { fetchAuthUser } from '@/lib/auth-api';
import { fetchMyProfile } from '@/lib/feed-api';
import { updateRepresentativeGame } from '@/lib/game-stats-api';
import { REPRESENTATIVE_GAME_LABEL, type RepresentativeGame } from '@/lib/representative-tier';

const GAMES: RepresentativeGame[] = ['LOL', 'VALORANT', 'PUBG', 'R6'];
// 서버의 연동 판정과 같은 키를 쓴다. LoL은 Riot 연동(RIOT 키), 발로란트는 별개 연동(VALORANT 키, #178)이다.
const CONNECTION_KEY: Record<RepresentativeGame, string> = { LOL: 'RIOT', VALORANT: 'VALORANT', PUBG: 'PUBG', R6: 'R6' };

function isConnected(gameStats: Record<string, unknown>, game: RepresentativeGame) {
  const stats = gameStats[CONNECTION_KEY[game]];
  return typeof stats === 'object' && stats !== null && (stats as { connected?: unknown }).connected === true;
}

/** 닉네임 옆에 티어 엠블럼을 표시할 대표 게임을 고른다. 연동한 게임만 고를 수 있다. */
export function RepresentativeGameSetting() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [connectedGames, setConnectedGames] = useState<Set<RepresentativeGame> | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const selected = user?.representativeGame ?? null;

  useEffect(() => {
    let cancelled = false;
    fetchMyProfile()
      .then((profile) => {
        if (cancelled) return;
        setConnectedGames(new Set(GAMES.filter((game) => isConnected(profile.gameStats ?? {}, game))));
      })
      .catch((error) => {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) return;
        setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = async (game: RepresentativeGame | null) => {
    if (isSaving || game === selected) return;
    setIsSaving(true);
    try {
      await updateRepresentativeGame(game);
      const me = await fetchAuthUser(user ?? undefined);
      updateUser({ representativeGame: me.representativeGame, representativeTier: me.representativeTier });
      toast.success(game ? '대표 게임을 변경했습니다.' : '대표 게임 표시를 껐습니다.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast.error(error instanceof Error ? error.message : '대표 게임을 변경하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const options: { value: RepresentativeGame | null; label: string; disabled: boolean }[] = [
    { value: null, label: '표시 안 함', disabled: false },
    ...GAMES.map((game) => {
      const connected = connectedGames?.has(game) ?? false;
      return {
        value: game,
        label: connected ? REPRESENTATIVE_GAME_LABEL[game] : `${REPRESENTATIVE_GAME_LABEL[game]} (연동 필요)`,
        // 선택된 게임은 연동 정보를 못 읽어도 보이게 둔다.
        disabled: !connected && selected !== game,
      };
    }),
  ];

  return (
    <div className="border-t border-zinc-200 pt-6">
      <h3 className="section-title mb-2">대표 게임</h3>
      <p className="mb-4 text-sm text-zinc-600">
        고른 게임의 티어 엠블럼이 닉네임 옆에 표시됩니다. 게임 전적은 프로필에서 연동할 수 있습니다.
      </p>
      {loadFailed ? (
        <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-300">
          연동한 게임 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      ) : null}
      <fieldset disabled={isSaving || (!connectedGames && !loadFailed)} aria-busy={isSaving} className="space-y-2">
        <legend className="sr-only">대표 게임 선택</legend>
        {options.map((option) => (
          <label
            key={option.value ?? 'none'}
            className={`flex h-11 items-center gap-3 rounded-xl border border-zinc-200 px-4 text-sm font-semibold dark:border-zinc-700 ${
              option.disabled ? 'cursor-not-allowed text-zinc-400' : 'cursor-pointer text-black dark:text-zinc-100'
            }`}
          >
            <input
              type="radio"
              name="representative-game"
              checked={selected === option.value}
              disabled={option.disabled}
              onChange={() => void handleChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
