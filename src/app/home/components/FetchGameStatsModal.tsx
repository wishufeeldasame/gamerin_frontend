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

  const handleConnect = (gameName: string) => {
    setConnectingGame(gameName);
    // 실제 구현 시에는 여기서 API를 호출하게 됩니다.
    setTimeout(() => {
      setConnectingGame(null);
      alert(`${gameName} 연동이 완료되었습니다!`);
    }, 1500);
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
                  disabled={connectingGame !== null}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all shadow-sm ${
                    connectingGame === game.name
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
        </motion.div>
      </div>
    </AnimatePresence>
  );
}