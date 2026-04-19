'use client';

import { X, ShieldCheck, Gamepad2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

// ✅ 에러 해결: 누락되었던 availableGames 데이터 소스를 상수로 추가합니다.
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

export function FetchGameStatsModal({ onClose }: FetchGameStatsModalProps) {
  // 연결 중인 게임의 이름을 담는 상태 (로딩 효과용)
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
    // 실제 구현 시에는 여기서 API를 호출하게 됩니다.
    setTimeout(() => {
      setConnectingGame(null);
      alert(`${gameName} 연동이 완료되었습니다!`);
    }, 1500);
  };

  const handlePubgSubmit = () => {
    if (!pubgNickname.trim()) {
      alert('PUBG 닉네임을 입력해주세요.');
      return;
    }

    setPubgPromptOpen(false);
    setConnectingGame('PUBG');

    setTimeout(() => {
      setConnectingGame(null);
      alert(`PUBG (${pubgNickname}) 연동이 완료되었습니다!`);
    }, 1500);
  };

  const handlePubgCancel = () => {
    setPubgPromptOpen(false);
    setPubgNickname('');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        {/* 배경 클릭 시 닫기 */}
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
          className="relative bg-white w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl"
        >
          {/* 상단 블랙 헤더 영역 */}
          <div className="bg-black p-8 text-white">
            <div className="flex justify-between items-center mb-6">
              <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center shadow-inner">
                <ShieldCheck size={28} className="text-green-500" />
              </div>
              <button 
                onClick={onClose} 
                className="w-10 h-10 flex items-center justify-center hover:bg-zinc-800 rounded-full transition-all text-zinc-500 hover:text-white"
              >
                <X size={24}/>
              </button>
            </div>
            <h2 className="text-2xl font-black tracking-tighter italic uppercase">Stat Sync Engine</h2>
            <p className="text-zinc-500 font-bold text-sm mt-1">공식 API를 통해 당신의 실력을 인증하세요.</p>
          </div>

          {/* 게임 리스트 영역 */}
          <div className="p-8 space-y-4 max-h-[400px] overflow-y-auto scrollbar-hide">
            {availableGames.map((game) => (
              <div 
                key={game.name} 
                className="flex items-center justify-between p-5 border border-zinc-100 rounded-[28px] hover:border-black transition-all group bg-zinc-50/50 hover:bg-white"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-white border border-zinc-100 rounded-xl flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all shadow-sm">
                    <Gamepad2 size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-black text-[15px] leading-none mb-1">{game.name}</h3>
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">{game.description}</p>
                  </div>
                </div>
                
                <button 
                  onClick={() => handleConnect(game.name)}
                  disabled={connectingGame !== null || pubgPromptOpen}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all shadow-sm ${
                    connectingGame === game.name || pubgPromptOpen
                      ? "bg-zinc-200 text-zinc-500 cursor-not-allowed"
                      : "bg-black text-white hover:bg-zinc-800 active:scale-95"
                  }`}
                >
                  {connectingGame === game.name ? "SYNCING..." : "CONNECT"}
                </button>
              </div>
            ))}
          </div>

          {/* 하단 푸터 */}
          <div className="p-8 bg-zinc-50 border-t border-zinc-100">
            <div className="flex items-center justify-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest text-center">
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
              <div className="relative w-full max-w-md rounded-[32px] bg-white shadow-2xl border border-zinc-200 overflow-hidden">
                <div className="p-6 border-b border-zinc-100">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black">PUBG 계정 연동</h3>
                      <p className="text-sm text-zinc-500 mt-1">닉네임을 입력하면 PUBG 계정 연동을 시작합니다.</p>
                    </div>
                    <button
                      onClick={handlePubgCancel}
                      className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <label className="block text-xs font-black uppercase tracking-[0.3em] text-zinc-400">닉네임</label>
                  <input
                    value={pubgNickname}
                    onChange={(event) => setPubgNickname(event.target.value)}
                    placeholder="PUBG 닉네임을 입력하세요"
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm font-bold text-black outline-none focus:border-black focus:bg-white transition"
                  />
                </div>

                <div className="flex items-center gap-4 p-6 border-t border-zinc-100 bg-zinc-50">
                  <button
                    onClick={handlePubgCancel}
                    className="flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 font-black text-sm text-zinc-700 hover:bg-zinc-100 transition"
                  >
                    취소
                  </button>
                  <button
                    onClick={handlePubgSubmit}
                    className="flex-1 rounded-2xl bg-black px-4 py-3 text-sm font-black text-white hover:bg-zinc-800 transition"
                  >
                    연결하기
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