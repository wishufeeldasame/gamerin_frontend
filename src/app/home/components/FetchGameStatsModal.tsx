'use client';

import { useToast } from '@/app/context/ToastContext';

import { X, ShieldCheck, Gamepad2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import {
  connectPubg,
  connectR6,
  fetchPubgSummary,
  GameStatsApiError,
} from '@/lib/game-stats-api';

const PUBG_NICKNAME_REGEX = /^[A-Za-z0-9_-]{4,16}$/;
const PUBG_NICKNAME_ERROR_MESSAGE =
  '닉네임은 4~16자의 영문, 숫자, 하이픈(-), 언더바(_)만 사용 가능합니다.';

type ConnectableGame = 'PUBG' | 'R6';

const availableGames: Array<{
  name: string;
  description: string;
  connectableGame?: ConnectableGame;
}> = [
  { name: 'League of Legends', description: '등급, 승률, 킬/데스/어시스트 비율 연동' },
  { name: 'VALORANT', description: '등급, 평균 전투 점수, 헤드샷 비율 연동' },
  { name: 'Overwatch 2', description: '실력 등급, 영웅 전적 연동' },
  { name: 'PUBG', description: '티어, 킬/데스 비율, 승률, 경기 수 연동', connectableGame: 'PUBG' },
  { name: 'Rainbow Six Siege', description: '티어, 킬/데스 비율, 승률, 경기 수 연동', connectableGame: 'R6' },
  { name: 'CS2', description: '프리미어 등급, 킬/데스 비율, 승률 연동' },
  { name: 'Apex Legends', description: '등급, 피해량, 킬/데스 비율 연동' },
];

interface FetchGameStatsModalProps {
  onClose: () => void;
  onConnected?: () => Promise<void> | void;
}

function getGameLabel(game: ConnectableGame) {
  return game === 'R6' ? 'Rainbow Six Siege' : 'PUBG';
}

function getConnectionErrorMessage(game: ConnectableGame, error: unknown) {
  if (!(error instanceof GameStatsApiError)) {
    return error instanceof Error ? error.message : `${getGameLabel(game)} 연동에 실패했습니다.`;
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

  return error.message;
}

function validatePlayerName(game: ConnectableGame, playerName: string) {
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

  const handleConnect = (gameName: string, connectableGame?: ConnectableGame) => {
    if (connectableGame) {
      setPlayerName('');
      setPlayerNameError('');
      setPromptGame(connectableGame);
      return;
    }

    setConnectingGame(gameName);
    setTimeout(() => {
      setConnectingGame(null);
      toast.info(`${gameName} 연동은 아직 지원되지 않습니다.`);
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
      } else {
        await connectR6(normalizedPlayerName);
        connectionCompleted = true;
      }

      await onConnected?.();
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

  const selectedGameLabel = promptGame ? getGameLabel(promptGame) : '';
  const promptDescription =
    promptGame === 'R6'
      ? 'PC Ubisoft Connect 닉네임을 입력해 전적을 연동하세요.'
      : 'PUBG 계정 연동을 시작하려면 닉네임을 입력하세요.';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
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
          className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-[40px] bg-white shadow-2xl"
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
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">게임 전적 연동</h2>
            <p className="mt-1 text-sm font-bold text-zinc-500">
              공식 게임 계정을 연결하고 최신 전적을 불러오세요.
            </p>
          </div>

          <div className="scrollbar-hide min-h-0 flex-1 space-y-4 overflow-y-auto p-8">
            {availableGames.map((game) => (
              <div
                key={game.name}
                className="group flex items-center justify-between gap-3 rounded-[28px] border border-zinc-100 bg-zinc-50/50 p-5 transition-all hover:border-black hover:bg-white"
              >
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-100 bg-white shadow-sm transition-all group-hover:bg-black group-hover:text-white">
                    <Gamepad2 size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="mb-1 text-[15px] font-black leading-none text-black">{game.name}</h3>
                    <p className="text-[11px] font-bold uppercase tracking-tight text-zinc-400">{game.description}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleConnect(game.name, game.connectableGame)}
                  disabled={connectingGame !== null || promptGame !== null}
                  className={`shrink-0 whitespace-nowrap rounded-xl px-5 py-2.5 text-xs font-black shadow-sm transition-all ${
                    connectingGame === game.name || promptGame !== null
                      ? 'cursor-not-allowed bg-zinc-200 text-zinc-500'
                      : 'bg-black text-white hover:bg-zinc-800 active:scale-95'
                  }`}
                >
                  {connectingGame === (game.connectableGame ?? game.name) ? '연동 중...' : '연결'}
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-zinc-100 bg-zinc-50 p-8">
            <div className="flex items-center justify-center gap-2">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              <p className="text-center text-[11px] font-black uppercase tracking-widest text-zinc-400">
                암호화 활성: 게임 API를 통한 보안 연결
              </p>
            </div>
          </div>

          {promptGame && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-6"
            >
              <div className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-zinc-200 bg-white shadow-2xl">
                <div className="border-b border-zinc-100 p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black">{selectedGameLabel} 연결</h3>
                      <p className="mt-1 text-sm text-zinc-500">{promptDescription}</p>
                    </div>
                    <button
                      onClick={handlePromptCancel}
                      className="h-10 w-10 rounded-full bg-zinc-100 text-zinc-500 transition hover:bg-zinc-200"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4 p-6">
                  <label className="block text-xs font-black uppercase tracking-[0.3em] text-zinc-400">
                    닉네임
                  </label>
                  <input
                    value={playerName}
                    onChange={(event) => {
                      setPlayerName(event.target.value);
                      setPlayerNameError('');
                    }}
                    placeholder={promptGame === 'R6' ? 'Ubisoft Connect 닉네임을 입력하세요' : 'PUBG 닉네임을 입력하세요'}
                    aria-invalid={Boolean(playerNameError)}
                    className={`w-full rounded-2xl border bg-zinc-50 px-4 py-4 text-sm font-bold text-black outline-none transition focus:bg-white ${
                      playerNameError
                        ? 'border-red-300 focus:border-red-500'
                        : 'border-zinc-200 focus:border-black'
                    }`}
                  />
                  {playerNameError ? (
                    <p className="text-xs font-bold leading-relaxed text-red-500">{playerNameError}</p>
                  ) : null}
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
                    className="flex-1 rounded-2xl bg-black px-4 py-3 text-sm font-black text-white transition hover:bg-zinc-800"
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
