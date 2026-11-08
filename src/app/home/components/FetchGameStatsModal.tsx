'use client';

import { useToast } from '@/app/context/ToastContext';

import Image from 'next/image';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { useEscapeKey } from '@/hooks/useEscapeKey';
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
  connectedGames?: readonly string[];
}

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
    // 429는 서버의 연동 시도 제한과 HenrikDev 한도 초과 모두 한글 안내를 주므로 그대로 보여 준다.
    if (error.status === 409 || error.status === 400 || error.status === 429) return error.message;
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

export function FetchGameStatsModal({ onClose, onConnected, connectedGames = [] }: FetchGameStatsModalProps) {
  const toast = useToast();
  const { updateUser } = useAuth();
  const [connectingGame, setConnectingGame] = useState<string | null>(null);
  const [promptGame, setPromptGame] = useState<ConnectableGame | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [playerNameError, setPlayerNameError] = useState('');
  const [valorantRegion, setValorantRegion] = useState<ValorantRegion>('KR');

  const handleConnect = (gameName: string, connectableGame?: ConnectableGame) => {
    if (connectableGame && connectedGames.includes(connectableGame)) return;
    if (connectableGame) {
      setPlayerName('');
      setPlayerNameError('');
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
    if (!promptGame || connectingGame) {
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
  };

  useEscapeKey(() => {
    if (connectingGame) return;
    if (promptGame) handlePromptCancel();
    else onClose();
  });

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
      <div className="modal-overlay z-[100]">
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
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-stats-title"
          className="modal-panel relative flex flex-col overflow-hidden lg:max-w-[480px]"
        >
          <div aria-hidden="true" className="modal-handle" />
          <div className="px-5 pt-4 lg:px-6 lg:pt-6">
            <div className="flex items-center justify-between gap-3">
              <h2 id="game-stats-title" className="text-title">게임 전적 연결</h2>
              <button
                onClick={onClose}
                type="button"
                aria-label="게임 전적 연결 닫기"
                className="btn-icon shrink-0"
              >
                <X size={24} />
              </button>
            </div>
            <p className="mt-1 text-body text-fg-secondary">
              공식 게임 계정을 연결하고 최신 전적을 불러오세요.
            </p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:px-6 lg:pb-6">
            {availableGames.map((game) => (
              <div
                key={game.name}
                className={`group shrink-0 items-center justify-between gap-3 rounded-control border border-line p-3 ${promptGame && promptGame === game.connectableGame ? 'hidden' : 'flex'}`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-control bg-subtle p-1">
                    <Image
                      src={game.iconUrl}
                      alt={`${game.name} 아이콘`}
                      fill
                      sizes="44px"
                      className={`object-contain p-1 ${game.invertInDark ? 'dark:invert' : ''}`}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className={`text-body ${game.connectableGame ? 'text-fg-primary' : 'text-fg-tertiary'}`}>{game.name}</h3>
                    <p className="mt-0.5 text-caption text-fg-secondary">{game.description}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleConnect(game.name, game.connectableGame)}
                  disabled={!game.connectableGame || connectedGames.includes(game.connectableGame) || connectingGame !== null || promptGame !== null}
                  className="h-10 shrink-0 rounded-control px-2 text-label text-fg-brand transition hover:bg-brand-subtle disabled:cursor-not-allowed disabled:text-fg-tertiary focus-visible:outline-2 focus-visible:outline-line-focus"
                >
                  {!game.connectableGame ? '지원 예정' : connectedGames.includes(game.connectableGame) ? '연동 완료' : connectingGame === game.connectableGame ? '연결 중...' : '연결'}
                </button>
              </div>
            ))}
          {promptGame && (
            <div className="order-first shrink-0">
              <div role="group" aria-labelledby="game-connect-title" className="rounded-control border border-brand bg-brand-subtle">
                <div className="p-5 pb-0">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 id="game-connect-title" className="text-heading">{selectedGameLabel} 연결</h3>
                      <p className="mt-1 text-label text-fg-secondary">{promptDescription}</p>
                    </div>
                    <button
                      onClick={handlePromptCancel}
                      type="button"
                      className="btn-icon shrink-0"
                      aria-label="연결 창 닫기"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <label htmlFor="game-player-name" className="block text-label text-fg-secondary">
                    {promptGame === 'LOL' || promptGame === 'VALORANT' ? 'Riot ID' : '닉네임'}
                  </label>
                  <input
                    id="game-player-name"
                    autoFocus
                    value={playerName}
                    onChange={(event) => {
                      setPlayerName(event.target.value);
                      setPlayerNameError('');
                    }}
                    placeholder={promptGame === 'LOL' ? '소환사#KR1' : promptGame === 'VALORANT' ? '요원#KR1' : promptGame === 'R6' ? 'Ubisoft Connect 닉네임을 입력하세요' : 'PUBG 닉네임을 입력하세요'}
                    aria-label={promptGame === 'LOL' || promptGame === 'VALORANT' ? 'Riot ID' : '게임 닉네임'}
                    aria-invalid={Boolean(playerNameError)}
                    className={`input-base ${
                      playerNameError
                        ? 'border-line-danger focus:border-line-danger'
                        : ''
                    }`}
                  />
                  {promptGame === 'VALORANT' ? (
                    <fieldset>
                      <legend className="mb-2 block text-label text-fg-secondary">리전</legend>
                      <div className="grid grid-cols-2 gap-2">
                        {VALORANT_REGIONS.map((region) => (
                          <label
                            key={region.value}
                            className={`flex cursor-pointer items-center justify-center rounded-control border px-3 py-3 text-label transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-line-focus ${
                              valorantRegion === region.value
                                ? 'border-brand bg-brand-subtle text-fg-brand'
                                : 'border-line bg-subtle text-fg-secondary hover:border-line-strong'
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
                    <p role="alert" className="text-caption text-fg-danger">{playerNameError}</p>
                  ) : null}
                </div>

                <div className="flex justify-end gap-2 px-5 pb-5">
                  <button
                    onClick={handlePromptCancel}
                    className="btn-secondary"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => void handleSubmit()}
                    className="btn-primary"
                  >
                    연결
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
