'use client';

import { ShieldCheck, Star, Users, Award, Zap, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const mentors = [
  {
    id: 1,
    name: '김신의 멘토',
    initials: 'KS',
    tags: ['#Next.js', '#Frontend', '#Valorant'],
    rating: 4.9,
    mentees: 42,
    tier: 'Immortal',
    status: 'MATCHING NOW',
  },
  {
    id: 2,
    name: '이정범 멘토',
    initials: 'JB',
    tags: ['#Spring', '#Backend', '#LOL'],
    rating: 5.0,
    mentees: 28,
    tier: 'Challenger',
    status: 'OFFLINE',
  }
];

export default function MentoringPage() {
  return (
    <div className="max-w-5xl mx-auto py-12 px-8">
      {/* 1. 헤더 영역: 확실한 블랙 타이포그래피로 시선 집중 */}
      <div className="mb-16">
        <div className="flex items-center gap-3 mb-4">
          <div className="px-3 py-1 bg-black text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-md">
            Professional
          </div>
        </div>
        <h1 className="text-5xl font-black text-black tracking-tighter italic uppercase mb-4">
          멘토링 
        </h1>
        </div>

      {/* 2. 멘토 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {mentors.map((mentor) => (
          <motion.div
            key={mentor.id}
            whileHover={{ y: -8 }}
            className="relative p-8 bg-white border-2 border-zinc-50 rounded-[40px] hover:border-black transition-all group shadow-[0_20px_40px_-20px_rgba(0,0,0,0.05)] hover:shadow-2xl"
          >
            {/* 상단: 상태 및 배지 */}
            <div className="flex justify-between items-start mb-8">
              <div className="w-20 h-20 bg-black rounded-3xl flex items-center justify-center text-white font-black text-3xl shadow-xl group-hover:scale-110 transition-transform duration-500">
                {mentor.initials}
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
                  <ShieldCheck size={12} />
                  <span className="text-[10px] font-black uppercase tracking-wider">Verified</span>
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border ${
                  mentor.status === 'MATCHING NOW' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-zinc-50 text-zinc-400 border-zinc-100'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${mentor.status === 'MATCHING NOW' ? 'bg-green-600 animate-pulse' : 'bg-zinc-300'}`} />
                  <span className="text-[10px] font-black uppercase tracking-wider">{mentor.status}</span>
                </div>
              </div>
            </div>

            {/* 본문: 가독성 극대화 텍스트 */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-2xl font-black text-black tracking-tight">{mentor.name}</h3>
                <span className="px-2 py-0.5 bg-zinc-900 text-white text-[9px] font-black rounded uppercase">{mentor.tier}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {mentor.tags.map(tag => (
                  <span key={tag} className="text-sm font-bold text-zinc-400 hover:text-black transition-colors cursor-default">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* 통계: 정보의 층위를 확실히 구분 */}
            <div className="flex items-center gap-8 py-6 border-t border-zinc-50 mb-8">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-zinc-300 uppercase">Rating</span>
                <div className="flex items-center gap-1.5 text-black font-black">
                  <Star size={16} className="fill-yellow-400 text-yellow-400" />
                  <span>{mentor.rating}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-zinc-300 uppercase">Students</span>
                <div className="flex items-center gap-1.5 text-black font-black">
                  <Users size={16} />
                  <span>{mentor.mentees}명</span>
                </div>
              </div>
            </div>

            {/* 액션 버튼: 압도적 존재감 */}
            <button className="group w-full py-4 bg-black text-white rounded-[24px] font-black text-sm hover:bg-zinc-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-zinc-200">
              <Zap size={18} className="fill-white" />
              멘토링 신청하기
              <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}