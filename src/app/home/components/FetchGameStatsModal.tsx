'use client';

import { useToast } from '@/app/context/ToastContext';

import Image from 'next/image';
import { X, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import {
  connectPubg,
  connectR6,
  connectRiot,
  connectValorant,
  fetchLolSummary,
  fetchPubgSummary,
  GameStatsApiError,
  type ValorantRegion,
} from '@/lib/game-stats-api';

const PUBG_NICKNAME_REGEX = /^[A-Za-z0-9_-]{4,16}$/;
const PUBG_NICKNAME_ERROR_MESSAGE =
  '닉네임은 4~16자의 영문, 숫자, 하이픈(-), 밑줄(_)만 사용 가능합니다.';

type ConnectableGame = 'PUBG' | 'R6' | 'LOL' | 'VALORANT';

const VALORANT_REGIONS: Array<{ value: ValorantRegion; label: string }> = [
  { value: 'KR', label: '한국 (KR)' },
  { value: 'AP', label: '아시아·태평양 (AP)' },
];

const availableGames: Array<{
  name: string;
  description: string;
  iconUrl: string;
  invertInDark?: boolean;
  connectableGame?: ConnectableGame;
}> = [
  { name: 'League of Legends', description: '티어, 승률, 최근 5경기 KDA', iconUrl: '/images/games/lol.png', connectableGame: 'LOL' },
  { name: 'VALORANT', description: '현재·최고 티어, 경쟁전 K/D·평균 전투 점수·헤드샷 비율', iconUrl: '/images/games/valorant.png', connectableGame: 'VALORANT' },
  { name: 'Overwatch 2', description: '실력 등급, 영웅 전적', iconUrl: '/images/games/overwatch2.png' },
  { name: 'PUBG', description: '티어, 킬/데스 비율, 승률, 경기 수', iconUrl: '/images/games/pubg.png', connectableGame: 'PUBG' },
  { name: 'Rainbow Six Siege', description: '티어, 킬/데스 비율, 승률, 경기 수', iconUrl: '/images/games/rainbow6.png', invertInDark: true, connectableGame: 'R6' },
  { name: 'CS2', description: '프리미어 등급, 킬/데스 비율, 승률', iconUrl: '/images/games/cs2.png', invertInDark: true },
  { name: 'Apex Legends', description: '등급, 피해량, 킬/데스 비율', iconUrl: '/images/games/apexlegend.png', invertInDark: true },
];

interface FetchGameStatsModalProps {
  onClose: () => void;
  onConnected?: () => Promise<void> | void;
}

const GAME_TRANSFER_RECIPIENT: Record<ConnectableGame, string> = {
  LOL: 'Riot API',
  PUBG: 'PUBG API',
  R6: 'r6data.com',
  VALORANT: 'HenrikDev API',
};

function getGameLabel(game: ConnectableGame) {
  if (game === 'LOL') return 'League of Legends';
  if (game === 'VALORANT') return 'VALORANT';
  return game === 'R6' ? 'Rainbow Six Siege' : 'PUBG';
}

function getConnectionErrorMessage(game: ConnectableGame, error: unknown) {
  if (!(error instanceof GameStatsApiError)) {
    return error instanceof Error ? error.message : `${getGameLabel(game)} 연결에 실패했습니다.`;
  }

  if (game === 'R6') {
    if (error.status === 404) {
      return 'PC Ubisoft Connect 닉네임을 확인해 주세요.';
    }
    if (error.status === 409) {
      return error.message;
    }
    if (error.status === 429) {
      return 'R6 전적 조회 요청이 많습니다. 잠시 후 다시 시도해 주세요.';
    }
    if (error.status === 502 || error.status === 503) {
      return 'R6 전적 서버를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.';
    }
  }

  if (game === 'VALORANT') {
    if (error.status === 404) return 'Riot ID를 확인해 주세요. (예: 닉네임#KR1)';
    if (error.status === 409 || error.status === 400) return error.message;
    if (error.status === 429) return '발로란트 전적 조회 요청이 많습니다. 잠시 후 다시 시도해 주세요.';
    if (error.status === 502 || error.status === 503) {
      return '발로란트 전적 서버를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.';
    }
  }

  if (game === 'LOL' && (error.status === 403 || error.status === 503)) {
    return 'Riot 전적 서버를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.';
  }

  return error.message;
}

function validatePlayerName(game: ConnectableGame, playerName: string) {
  if (game === 'LOL' || game === 'VALORANT') {
    return /^[^#\r\n]+#[^#\s]+$/.test(playerName) && playerName.split('#').every((part) => part.trim())
      ? ''
      : 'Riot ID를 닉네임#태그 형식으로 입력해 주세요. (예: 소환사#KR1)';
  }
  if (game === 'PUBG') {
    return PUBG_NICKNAME_REGEX.test(playerName) ? '' : PUBG_NICKNAME_ERROR_MESSAGE;
  }

  if (!playerName) {
    return 'Ubisoft Connect 닉네임을 입력해 주세요.';
  }

  if (playerName.length > 100) {
    return '닉네임은 100자 이하여야 합니다.';
  }

  return '';
}

export function FetchGameStatsModal({ onClose, onConnected }: FetchGameStatsModalProps) {
  const toast = useToast();
  const { updateUser } = useAuth();
  const [connectingGame, setConnectingGame] = useState<string | null>(null);
  const [promptGame, setPromptGame] = useState<ConnectableGame | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [playerNameError, setPlayerNameError] = useState('');
  const [transferConsent, setTransferConsent] = useState(false);
  const [valorantRegion, setValorantRegion] = useState<ValorantRegion>('KR');

  const handleConnect = (gameName: string, connectableGame?: ConnectableGame) => {
    if (connectableGame) {
      setPlayerName('');
      setPlayerNameError('');
      setTransferConsent(false);
      setValorantRegion('KR');
      setPromptGame(connectableGame);
      return;
    }

    setConnectingGame(gameName);
    setTimeout(() => {
      setConnectingGame(null);
      toast.info(`${gameName} 연결은 아직 지원되지 않습니다.`);
    }, 1000);
  };

  const handleSubmit = async () => {
    if (!promptGame || connectingGame || !transferConsent) {
      return;
    }

    const normalizedPlayerName = playerName.trim();
    const validationMessage = validatePlayerName(promptGame, normalizedPlayerName);
    if (validationMessage) {
      setPlayerNameError(validationMessage);
      return;
    }

    const selectedGame = promptGame;
    let connectionCompleted = false;
    let summaryError: unknown;
    setPlayerNameError('');
    setPromptGame(null);
    setConnectingGame(selectedGame);

    try {
      if (selectedGame === 'PUBG') {
        await connectPubg(normalizedPlayerName);
        connectionCompleted = true;

        try {
          const summary = await fetchPubgSummary();
          if (summary.tierLabel) {
            updateUser({ gameTier: summary.tierLabel });
          }
        } catch {
          // PUBG 연결은 완료된 상태이므로 프로필 재조회로 저장된 연결 상태를 반영한다.
        }
      } else if (selectedGame === 'LOL') {
        await connectRiot(normalizedPlayerName);
        connectionCompleted = true;
        try {
          const summary = await fetchLolSummary();
          if (summary.tierLabel && summary.tierLabel !== 'UNRANKED') {
            updateUser({ gameTier: summary.tierLabel });
          }
        } catch (error) {
          summaryError = error;
        }
      } else if (selectedGame === 'VALORANT') {
        // 연동 응답 전에 서버가 티어·경쟁전 전적까지 저장하므로 별도 요약 조회가 필요 없다.
        await connectValorant(normalizedPlayerName, valorantRegion);
        connectionCompleted = true;
      } else {
        await connectR6(normalizedPlayerName);
        connectionCompleted = true;
      }

      await onConnected?.();
      if (summaryError) {
        toast.error(`Riot 계정은 연결됐지만 전적을 불러오지 못했습니다. 프로필에서 전적 새로고침을 눌러 다시 시도해 주세요. ${getConnectionErrorMessage('LOL', summaryError)}`);
        onClose();
        return;
      }
      toast.success(`${getGameLabel(selectedGame)} (${normalizedPlayerName}) 계정이 연결되었습니다.`);
      onClose();
    } catch (error) {
      if (connectionCompleted) {
        toast.error(
          `${getGameLabel(selectedGame)} 계정 연결은 완료됐지만 프로필 화면을 갱신하지 못했습니다. 새로고침 후 다시 확인해 주세요.`,
        );
        onClose();
        return;
      }

      setPromptGame(selectedGame);
      setPlayerNameError(getConnectionErrorMessage(selectedGame, error));
    } finally {
      setConnectingGame(null);
    }
  };

  const handlePromptCancel = () => {
    setPromptGame(null);
    setPlayerName('');
    setPlayerNameError('');
    setTransferConsent(false);
  };

  const selectedGameLabel = promptGame ? getGameLabel(promptGame) : '';
  const promptDescription =
    promptGame === 'LOL'
      ? '한국 서버 Riot ID를 닉네임#태그 형식으로 입력하세요.'
      : promptGame === 'VALORANT'
      ? 'PC 발로란트 Riot ID와 리전을 선택하세요. 전적은 경쟁전 기준입니다.'
      : promptGame === 'R6'
      ? 'PC Ubisoft Connect 닉네임을 입력해 전적을 연결하세요.'
      : 'PUBG 계정 연결을 시작하려면 닉네임을 입력하세요.';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0"
          onClick={onClose}
        />

        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        >
          <div className="bg-black p-8 text-white">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800 shadow-inner">
                <ShieldCheck size={28} className="text-green-500" />
              </div>
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition-all hover:bg-zinc-800 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">게임 전적 연결</h2>
            <p className="mt-1 text-sm font-bold text-zinc-500">
              공식 게임 계정을 연결하고 최신 전적을 불러오세요.
            </p>
          </div>

          <div className="scrollbar-hide min-h-0 flex-1 space-y-4 overflow-y-auto p-8">
            {availableGames.map((game) => (
              <div
                key={game.name}
                className="group flex items-center justify-between gap-3 rounded-3xl border border-zinc-100 bg-zinc-50/50 p-5 transition-all hover:border-black hover:bg-white dark:bg-surface dark:hover:!border-neutral-600 dark:hover:bg-surface-elevated"
              >
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-100 bg-white p-1 shadow-sm">
                    <Image
                      src={game.iconUrl}
                      alt={`${game.name} 아이콘`}
                      fill
                      sizes="44px"
                      className={`object-contain p-1 ${game.invertInDark ? 'dark:invert' : ''}`}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="mb-1 text-base font-black leading-none text-black">{game.name}</h3>
                    <p className="text-xs font-bold uppercase tracking-tight text-zinc-400">{game.description}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleConnect(game.name, game.connectableGame)}
                  disabled={connectingGame !== null || promptGame !== null}
                  className={`shrink-0 whitespace-nowrap rounded-xl px-5 py-2.5 text-xs font-black shadow-sm transition-all ${
                    connectingGame === game.name || promptGame !== null
                      ? 'cursor-not-allowed bg-zinc-200 text-zinc-500 dark:bg-surface-elevated'
                      : 'bg-black text-white hover:bg-zinc-800 active:scale-95'
                  }`}
                >
                  {connectingGame === (game.connectableGame ?? game.name) ? '연결 중...' : '연결'}
                </button>
              </div>
            ))}
          </div>

          {promptGame && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-6"
            >
              <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl">
                <div className="border-b border-zinc-100 p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black">{selectedGameLabel} 연결</h3>
                      <p className="mt-1 text-sm text-zinc-500">{promptDescription}</p>
                    </div>
                    <button
                      onClick={handlePromptCancel}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition hover:bg-zinc-200"
                      aria-label="연결 창 닫기"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4 p-6">
                  <label className="block text-xs font-black uppercase tracking-[0.3em] text-zinc-400">
                    {promptGame === 'LOL' || promptGame === 'VALORANT' ? 'Riot ID' : '닉네임'}
                  </label>
                  <input
                    value={playerName}
                    onChange={(event) => {
                      setPlayerName(event.target.value);
                      setPlayerNameError('');
                    }}
                    placeholder={promptGame === 'LOL' ? '소환사#KR1' : promptGame === 'VALORANT' ? '요원#KR1' : promptGame === 'R6' ? 'Ubisoft Connect 닉네임을 입력하세요' : 'PUBG 닉네임을 입력하세요'}
                    aria-label={promptGame === 'LOL' || promptGame === 'VALORANT' ? 'Riot ID' : '게임 닉네임'}
                    aria-invalid={Boolean(playerNameError)}
                    className={`w-full rounded-2xl border bg-zinc-50 px-4 py-4 text-sm font-bold text-black outline-none transition focus:bg-white dark:placeholder:!text-zinc-400 dark:focus:bg-surface ${
                      playerNameError
                        ? 'border-red-300 focus:border-red-500 dark:!border-red-400 dark:focus:!border-red-400'
                        : 'border-zinc-200 focus:border-black dark:focus:!border-[#f5b93d]'
                    }`}
                  />
                  {promptGame === 'VALORANT' ? (
                    <fieldset>
                      <legend className="mb-2 block text-xs font-black uppercase tracking-[0.3em] text-zinc-400">리전</legend>
                      <div className="grid grid-cols-2 gap-2">
                        {VALORANT_REGIONS.map((region) => (
                          <label
                            key={region.value}
                            className={`flex cursor-pointer items-center justify-center rounded-2xl border px-3 py-3 text-sm font-bold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-black dark:has-[:focus-visible]:ring-[#f5b93d] ${
                              valorantRegion === region.value
                                ? 'border-black bg-black text-white dark:!border-[#f5b93d] dark:bg-[#f5b93d] dark:text-black'
                                : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-400'
                            }`}
                          >
                            <input
                              type="radio"
                              name="valorant-region"
                              value={region.value}
                              checked={valorantRegion === region.value}
                              onChange={() => setValorantRegion(region.value)}
                              className="sr-only"
                            />
                            {region.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ) : null}
                  {playerNameError ? (
                    <p className="text-xs font-bold leading-relaxed text-red-500">{playerNameError}</p>
                  ) : null}
                  <label className="flex items-start gap-2 text-xs font-bold leading-relaxed text-zinc-500">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 accent-black dark:accent-[#f5b93d]"
                      checked={transferConsent}
                      onChange={(event) => setTransferConsent(event.target.checked)}
                    />
                    전적 조회를 위해 입력한 정보를 국외의 {GAME_TRANSFER_RECIPIENT[promptGame]}로 보내는 데
                    동의합니다.
                  </label>
                </div>

                <div className="flex items-center gap-4 border-t border-zinc-100 bg-zinc-50 p-6">
                  <button
                    onClick={handlePromptCancel}
                    className="flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-700 transition hover:bg-zinc-100"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => void handleSubmit()}
                    disabled={!transferConsent}
                    className="btn-primary flex-1"
                  >
                    연결
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
