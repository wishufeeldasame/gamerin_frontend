'use client';

import Image from 'next/image';
import { X, Star, Calendar, Clock, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface Mentor {
  id: number;
  name: string;
  image: string;
  rating: number;
  reviews: number;
  games: string[];
  rank: string;
  price: number;
  badge: string;
  verified: boolean;
}

interface MentorDetailModalProps {
  mentor: Mentor;
  onClose: () => void;
}

const mentorReviews = [
  { user: 'Sarah Kim', rating: 5, comment: '최고의 멘토입니다! 2주 만에 골드에서 다이아몬드까지 올라갔어요.', date: '2 days ago' },
  { user: 'Mike Lee', rating: 5, comment: '설명이 매우 논리적이고 친절합니다. 운영법 배우기에 최고예요.', date: '1 week ago' },
];

export function MentorDetailModal({ mentor, onClose }: MentorDetailModalProps) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const isBookingReady = Boolean(selectedDate && selectedTime);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0" onClick={onClose} 
        />

        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 30 }}
          className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-[48px] overflow-hidden shadow-2xl flex flex-col md:flex-row"
        >
          {/* Left: Mentor Visual */}
          <div className="md:w-2/5 bg-black relative">
            <Image
              src={mentor.image} 
              alt={mentor.name}
              fill
              sizes="(max-width: 768px) 100vw, 40vw"
              className="object-cover opacity-60 grayscale-[0.3]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
            <div className="absolute bottom-10 left-10 right-10">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-3 py-1 bg-white text-black text-[10px] font-black uppercase rounded-lg">
                  {mentor.rank}
                </span>
                {mentor.verified && <ShieldCheck className="text-blue-400" size={20} />}
              </div>
              <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-tight mb-2">
                {mentor.name}
              </h2>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="text-white font-black text-lg">{mentor.rating}</span>
                <span className="text-zinc-500 font-bold ml-1">({mentor.reviews} reviews)</span>
              </div>
            </div>
            
            <button onClick={onClose} className="absolute top-8 left-8 w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all">
              <X size={20} />
            </button>
          </div>

          {/* Right: Booking & Info */}
          <div className="md:w-3/5 p-10 overflow-y-auto bg-white">
            <div className="mb-10">
              <h4 className="text-[11px] font-black text-zinc-400 uppercase tracking-widest mb-4">About Mentoring</h4>
              <p className="text-zinc-600 font-bold leading-relaxed">
                개개인의 성향을 파악하여 맞춤형 피드백을 제공합니다. 
                리플레이 분석부터 실시간 인게임 코칭까지, 확실한 실력 향상을 보장합니다.
              </p>
            </div>

            {/* Booking Form */}
            <div className="grid grid-cols-2 gap-4 mb-10">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-black uppercase ml-1">Select Date</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-zinc-100 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-black uppercase ml-1">Select Time</label>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <select 
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-zinc-100 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-black appearance-none"
                  >
                    <option value="">Choose Time</option>
                    <option value="14:00">14:00 PM</option>
                    <option value="16:00">16:00 PM</option>
                    <option value="20:00">20:00 PM</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Reviews Section */}
            <div className="mb-10">
              <h4 className="text-[11px] font-black text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                Recent Reviews <div className="h-px flex-1 bg-zinc-100" />
              </h4>
              <div className="space-y-6">
                {mentorReviews.map((review, i) => (
                  <div key={i} className="group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-black text-black text-sm">{review.user}</div>
                      <div className="text-[10px] font-bold text-zinc-400 uppercase">{review.date}</div>
                    </div>
                    <p className="text-zinc-500 text-sm font-medium leading-snug group-hover:text-black transition-colors">
                      &quot;{review.comment}&quot;
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Footer */}
            <div className="sticky bottom-0 bg-white pt-6 border-t border-zinc-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total Price</p>
                <p className="text-2xl font-black text-black italic">₩{mentor.price.toLocaleString()}</p>
              </div>
              <button
                disabled={!isBookingReady}
                className="px-10 py-4 bg-black text-white text-sm font-black uppercase rounded-[20px] hover:bg-zinc-800 transition-all shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"
              >
                {isBookingReady ? 'Confirm Booking' : 'Select Date & Time'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
