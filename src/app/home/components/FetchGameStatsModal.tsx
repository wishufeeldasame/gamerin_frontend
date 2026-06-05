'use client';

import { X, ShieldCheck, Gamepad2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { getAccessToken } from '@/lib/auth-store';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';


const availableGames = [
  {
    name: 'League of Legends',
    description: 'Sync Rank, Win Rate, KDA',
  },
  {
    name: 'VALORANT',
    description: 'Sync Rank, ACS, Headshot %',
  },
  {
    name: 'Overwatch 2',
    description: 'Sync Skill Tier, Hero Stats',
  },
  {
    name: 'PUBG',
    description: 'Sync Survival Level, KD, ADR',
  },
  {
    name: 'CS2',
    description: 'Sync Premier Rank, K/D, Win Rate',
  },
  {
    name: 'Apex Legends',
    description: 'Sync Rank, Damage, K/D',
  },
];

interface FetchGameStatsModalProps {
  onClose: () => void;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface PubgSummaryResponse {
  gameName: string;
  tierLabel: string | null;
  kda: number;
  winRate: number;
  games: number;
  connected: boolean;
}

export function FetchGameStatsModal({ onClose }: FetchGameStatsModalProps) {
  const { updateUser } = useAuth();
  const [connectingGame, setConnectingGame] = useState<string | null>(null);
  const [pubgNickname, setPubgNickname] = useState('');
  const [pubgPromptOpen, setPubgPromptOpen] = useState(false);

  const handleConnect = (gameName: string) => {
    if (gameName === 'PUBG') {
      setPubgNickname('');
      setPubgPromptOpen(true);
      return;
    }

    setConnectingGame(gameName);
    setTimeout(() => {
      setConnectingGame(null);
      alert(`${gameName} integration is not connected yet.`);
    }, 1000);
  };

  const handlePubgSubmit = async () => {
    const playerName = pubgNickname.trim();
    if (!playerName) {
      alert('Please enter your PUBG nickname.');
      return;
    }

    const accessToken = getAccessToken();
    if (!accessToken) {
      alert('Please log in before connecting PUBG.');
      return;
    }

    setPubgPromptOpen(false);
    setConnectingGame('PUBG');

    try {
      const connectResponse = await fetch(`${API_BASE}/api/v1/pubg/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({ playerName }),
      });

      const connectBody = (await connectResponse.json().catch(() => null)) as
        | ApiResponse<{ connected: boolean; playerName: string }>
        | { message?: string }
        | null;

      if (!connectResponse.ok) {
        throw new Error(
          (connectBody as { message?: string } | null)?.message ??
            'Failed to connect PUBG.'
        );
      }

      const summaryResponse = await fetch(`${API_BASE}/api/v1/pubg/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });

      if (summaryResponse.ok) {
        const summaryBody = (await summaryResponse.json().catch(() => null)) as
          | ApiResponse<PubgSummaryResponse>
          | null;
        const tierLabel = summaryBody?.data?.tierLabel;
        if (tierLabel) {
          updateUser({ gameTier: tierLabel });
        }
      }

      setConnectingGame(null);
      setPubgNickname('');
      alert(`PUBG (${playerName}) connected successfully.`);
      onClose();
    } catch (error) {
      setConnectingGame(null);
      setPubgPromptOpen(true);
      alert(error instanceof Error ? error.message : 'Failed to connect PUBG.');
    }
  };

  const handlePubgCancel = () => {
    setPubgPromptOpen(false);
    setPubgNickname('');
  };

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
          className="relative w-full max-w-lg overflow-hidden rounded-[40px] bg-white shadow-2xl"
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
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">
              Stat Sync Engine
            </h2>
            <p className="mt-1 text-sm font-bold text-zinc-500">
              Connect your official game account and import live stats.
            </p>
          </div>

          <div className="scrollbar-hide max-h-[400px] space-y-4 overflow-y-auto p-8">
            {availableGames.map((game) => (
              <div
                key={game.name}
                className="group flex items-center justify-between rounded-[28px] border border-zinc-100 bg-zinc-50/50 p-5 transition-all hover:border-black hover:bg-white"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-100 bg-white shadow-sm transition-all group-hover:bg-black group-hover:text-white">
                    <Gamepad2 size={20} />
                  </div>
                  <div>
                    <h3 className="mb-1 text-[15px] font-black leading-none text-black">
                      {game.name}
                    </h3>
                    <p className="text-[11px] font-bold uppercase tracking-tight text-zinc-400">
                      {game.description}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleConnect(game.name)}
                  disabled={connectingGame !== null || pubgPromptOpen}
                  className={`rounded-xl px-5 py-2.5 text-xs font-black shadow-sm transition-all ${
                    connectingGame === game.name || pubgPromptOpen
                      ? 'cursor-not-allowed bg-zinc-200 text-zinc-500'
                      : 'bg-black text-white hover:bg-zinc-800 active:scale-95'
                  }`}
                >
                  {connectingGame === game.name ? 'SYNCING...' : 'CONNECT'}
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-zinc-100 bg-zinc-50 p-8">
            <div className="flex items-center justify-center gap-2">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              <p className="text-center text-[11px] font-black uppercase tracking-widest text-zinc-400">
                Encryption Active: Secured via Game API
              </p>
            </div>
          </div>

          {pubgPromptOpen && (
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
                      <h3 className="text-xl font-black">Connect PUBG</h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        Enter your nickname to start PUBG account sync.
                      </p>
                    </div>
                    <button
                      onClick={handlePubgCancel}
                      className="h-10 w-10 rounded-full bg-zinc-100 text-zinc-500 transition hover:bg-zinc-200"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4 p-6">
                  <label className="block text-xs font-black uppercase tracking-[0.3em] text-zinc-400">
                    Nickname
                  </label>
                  <input
                    value={pubgNickname}
                    onChange={(event) => setPubgNickname(event.target.value)}
                    placeholder="Enter your PUBG nickname"
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm font-bold text-black outline-none transition focus:border-black focus:bg-white"
                  />
                </div>

                <div className="flex items-center gap-4 border-t border-zinc-100 bg-zinc-50 p-6">
                  <button
                    onClick={handlePubgCancel}
                    className="flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-700 transition hover:bg-zinc-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePubgSubmit}
                    className="flex-1 rounded-2xl bg-black px-4 py-3 text-sm font-black text-white transition hover:bg-zinc-800"
                  >
                    Connect
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
