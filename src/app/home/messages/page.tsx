'use client';

import { Search, Send, MoreHorizontal, ShieldCheck, Plus, Image as ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';

export default function MessagesPage() {
  const [message, setMessage] = useState('');

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-white overflow-hidden">
      {/* 1. 왼쪽 대화 목록 (Sidebar) */}
      <div className="w-[380px] border-r border-zinc-100 flex flex-col bg-white">
        <div className="p-8 pb-4">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-black text-black tracking-tighter italic uppercase">메세지</h1>
            <button className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white hover:scale-105 transition-all shadow-lg">
              <Plus size={20} />
            </button>
          </div>
          
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-black transition-colors" size={18} />
            <input 
              placeholder="게이머 검색..." 
              className="w-full pl-12 pr-4 py-4 bg-zinc-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-black transition-all" 
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 scrollbar-hide">
          {/* 활성화된 채팅 아이템 */}
          <div className="p-5 bg-black text-white rounded-[32px] shadow-xl cursor-pointer transform transition-all active:scale-[0.98]">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center font-black text-sm border border-white/10">SC</div>
                <div>
                  <p className="font-black text-[15px]">Sarah Chen</p>
                  <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-widest">Valorant Pro</p>
                </div>
              </div>
              <span className="text-[10px] text-zinc-500 font-black">2M AGO</span>
            </div>
            <p className="text-sm text-zinc-300 truncate font-medium pl-1">GG! 어제 랭크전 정말 재밌었어요. 櫨</p>
          </div>

          {/* 대기 중인 채팅 아이템 */}
          <div className="p-5 hover:bg-zinc-50 rounded-[32px] cursor-pointer transition-all border border-transparent hover:border-zinc-100">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center font-black text-black text-sm">JP</div>
                <div>
                  <p className="font-black text-[15px] text-black">James Park</p>
                  <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-widest">Elden Ring God</p>
                </div>
              </div>
              <span className="text-[10px] text-zinc-300 font-black">1H AGO</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 오른쪽 메인 대화창 */}
      <div className="flex-1 flex flex-col bg-zinc-50/30 relative">
        {/* 채팅 상단바 */}
        <div className="px-8 py-5 bg-white/80 backdrop-blur-md border-b border-zinc-100 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-lg">SC</div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-4 border-white rounded-full" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-black text-lg text-black tracking-tight leading-none">Sarah Chen</p>
                <ShieldCheck size={16} className="text-blue-500 fill-blue-500/10" />
              </div>
              <p className="text-[11px] text-green-600 font-black uppercase tracking-widest mt-1">Online Now</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <button className="p-3 hover:bg-zinc-100 rounded-2xl transition-all text-zinc-400 hover:text-black"><MoreHorizontal size={24} /></button>
          </div>
        </div>
        
        {/* 메시지 리스트 */}
        <div className="flex-1 p-8 space-y-6 overflow-y-auto scrollbar-hide">
          {/* 상대방 말풍선 */}
          <div className="flex justify-start items-end gap-3 max-w-[80%]">
            <div className="w-8 h-8 bg-zinc-200 rounded-xl flex-shrink-0 flex items-center justify-center text-[10px] font-black">SC</div>
            <div className="bg-white text-zinc-800 px-6 py-4 rounded-[28px] rounded-bl-none shadow-sm border border-zinc-100 font-medium text-[15px] leading-relaxed">
              신의님, 저번에 말씀하신 멘토링 일정 확인하셨나요?
            </div>
          </div>

          {/* 내 말풍선 */}
          <div className="flex justify-end items-end gap-2">
             <span className="text-[10px] font-black text-zinc-300 mb-2 uppercase">Read 05:32</span>
             <div className="bg-black text-white px-6 py-4 rounded-[28px] rounded-br-none shadow-xl font-medium text-[15px] leading-relaxed max-w-[80%]">
               네! 오늘 저녁 발로란트 한판 하고 나서 바로 진행하면 좋을 것 같아요. 🚀
             </div>
          </div>
        </div>

        {/* 메시지 입력창 */}
        <div className="p-8 bg-white border-t border-zinc-100">
          <div className="max-w-4xl mx-auto flex items-center gap-4 bg-zinc-50 p-2 rounded-[32px] focus-within:ring-2 focus-within:ring-black focus-within:bg-white transition-all shadow-inner">
            <button className="p-4 hover:bg-zinc-200 rounded-2xl text-zinc-400 transition-all">
              <Plus size={20} />
            </button>
            <input 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="메시지를 입력하세요..." 
              className="flex-1 bg-transparent border-none text-[15px] font-bold text-black outline-none placeholder:text-zinc-400 px-2" 
            />
            <button 
              className={`p-4 rounded-2xl transition-all shadow-lg ${
                message.trim() ? "bg-black text-white hover:scale-105 active:scale-95" : "bg-zinc-200 text-zinc-400"
              }`}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}