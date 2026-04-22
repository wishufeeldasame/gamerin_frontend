'use client';

import Image from 'next/image';
import { Search, Star, Filter, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { MentorDetailModal, type Mentor } from './MentorDetailModal';

const mentors: Mentor[] = [
  {
    id: 1,
    name: 'ProGamer',
    image: 'https://images.unsplash.com/photo-1607796884038-3638822d5ee2?w=400',
    rating: 4.9,
    reviews: 127,
    games: ['League of Legends', 'Valorant'],
    rank: 'Challenger',
    price: 25000,
    badge: 'Mentoring',
    verified: true,
  },
  {
    id: 2,
    name: 'Kim ProPlayer',
    image: 'https://images.unsplash.com/photo-1529981188441-8a2e6fe30103?w=400',
    rating: 5.0,
    reviews: 203,
    games: ['Valorant', 'PUBG'],
    rank: 'Radiant',
    price: 30000,
    badge: 'Pro',
    verified: true,
  },
  {
    id: 3,
    name: 'Lee Mentor',
    image: 'https://images.unsplash.com/photo-1774060526585-19be7b4af255?w=400',
    rating: 4.8,
    reviews: 85,
    games: ['Overwatch 2'],
    rank: 'Grandmaster',
    price: 18000,
    badge: 'Expert',
    verified: false,
  },
];

export function Mentoring() {
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null);

  return (
    <div className="max-w-6xl mx-auto py-10 px-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tighter italic uppercase text-black mb-2">
            Pro Mentoring
          </h1>
          <p className="text-zinc-500 font-bold text-sm">최정상급 플레이어에게 배우는 승리의 기술</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-black transition-colors" />
            <input
              type="text"
              placeholder="Search by game or mentor..."
              className="w-64 h-12 pl-11 pr-4 bg-zinc-100 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-black transition-all"
            />
          </div>
          <button className="w-12 h-12 flex items-center justify-center bg-black text-white rounded-2xl hover:scale-105 transition-transform shadow-lg">
            <Filter size={20} />
          </button>
        </div>
      </div>

      {/* Mentors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {mentors.map((mentor) => (
          <motion.div
            key={mentor.id}
            whileHover={{ y: -10 }}
            className="group relative bg-white border border-zinc-100 rounded-[40px] overflow-hidden shadow-sm hover:shadow-2xl transition-all"
          >
            {/* Image Section */}
            <div className="relative h-64 overflow-hidden">
              <Image
                src={mentor.image}
                alt={mentor.name}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              
              <div className="absolute top-5 left-5 flex gap-2">
                <span className="px-4 py-1.5 bg-white/90 backdrop-blur-md text-black text-[10px] font-black uppercase rounded-full shadow-sm">
                  {mentor.rank}
                </span>
                {mentor.verified && (
                  <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg">
                    <CheckCircle2 size={16} />
                  </div>
                )}
              </div>

              <div className="absolute bottom-5 left-6 right-6">
                <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">
                  {mentor.name}
                </h3>
              </div>
            </div>

            {/* Info Section */}
            <div className="p-8">
              <div className="flex items-center gap-1 mb-4">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-black text-black">{mentor.rating}</span>
                <span className="text-xs font-bold text-zinc-400">({mentor.reviews} reviews)</span>
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                {mentor.games.map((game) => (
                  <span key={game} className="px-3 py-1 bg-zinc-100 text-zinc-600 text-[10px] font-black uppercase rounded-lg">
                    {game}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-zinc-100">
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Hourly Rate</p>
                  <p className="text-xl font-black text-black italic">
                    ₩{mentor.price.toLocaleString()}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedMentor(mentor)}
                  className="px-6 py-3 bg-black text-white text-xs font-black uppercase rounded-2xl hover:bg-zinc-800 transition-colors shadow-lg active:scale-95"
                >
                  Book Now
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {selectedMentor && (
        <MentorDetailModal
          mentor={selectedMentor}
          onClose={() => setSelectedMentor(null)}
        />
      )}
    </div>
  );
}
