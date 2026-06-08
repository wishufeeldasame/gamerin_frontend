'use client';

import Image from 'next/image';
import { X, Camera, MapPin, Globe, AlignLeft, User } from 'lucide-react';
import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEFAULT_PROFILE_COVER } from '@/lib/profile-constants';

interface EditProfileModalProps {
  onClose: () => void;
  coverImage: string | null;
  onSaveCover: (coverUrl: string) => void;
  avatarImage: string | null;
  onSaveAvatar: (avatarUrl: string | null) => void;
  userInfo?: {
    name: string;
    bio: string;
    location: string;
    website: string;
  };
  onSaveUserInfo?: (userInfo: { name: string; bio: string; location: string; website: string }) => void | Promise<void>;
}

export function EditProfileModal({
  onClose,
  coverImage,
  onSaveCover,
  avatarImage,
  onSaveAvatar,
  userInfo,
  onSaveUserInfo,
}: EditProfileModalProps) {
  const [formData, setFormData] = useState({
    name: userInfo?.name || '',
    bio: userInfo?.bio || '',
    location: userInfo?.location || '',
    website: userInfo?.website || '',
  });
  const [coverPreview, setCoverPreview] = useState<string>(coverImage || DEFAULT_PROFILE_COVER);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(avatarImage);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setCoverPreview(coverImage || DEFAULT_PROFILE_COVER);
  }, [coverImage]);

  useEffect(() => {
    setAvatarPreview(avatarImage);
  }, [avatarImage]);

  const handleCoverClick = () => {
    fileInputRef.current?.click();
  };

  const handleCoverSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCoverPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarClick = () => {
    avatarFileInputRef.current?.click();
  };

  const handleAvatarSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetCover = () => {
    setCoverPreview(DEFAULT_PROFILE_COVER);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (saving) return;

    try {
      setSaving(true);
      onSaveCover(coverPreview);
      onSaveAvatar(avatarPreview);
      await onSaveUserInfo?.(formData);
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[40px] shadow-2xl scrollbar-hide"
        >
          <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-100 px-8 py-5 flex items-center justify-between z-20">
            <div className="flex items-center gap-4">
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-all text-zinc-400 hover:text-black"
              >
                <X size={24} />
              </button>
              <h2 className="text-xl font-black text-black tracking-tighter italic uppercase">Edit Profile</h2>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-2.5 bg-black text-white font-black rounded-2xl hover:bg-zinc-800 transition-all text-sm shadow-lg shadow-zinc-200 disabled:bg-zinc-300"
            >
              {saving ? 'SAVING...' : 'SAVE'}
            </button>
          </div>

          <div onClick={handleCoverClick} className="relative h-48 bg-zinc-900 group cursor-pointer overflow-hidden">
            <Image
              src={coverPreview}
              alt="Cover"
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-all">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-xl">
                  <Camera size={24} />
                </div>
                <span className="text-white text-[11px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                  Change Cover
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleResetCover();
              }}
              className="absolute bottom-4 right-4 rounded-xl bg-white/90 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-black shadow-lg transition hover:bg-white"
            >
              Reset Cover
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
          </div>

          <div className="px-8 -mt-16 relative z-10">
            <div className="relative w-32 h-32 group cursor-pointer" onClick={handleAvatarClick}>
              <div className="relative w-full h-full bg-black rounded-[40px] border-[6px] border-white flex items-center justify-center text-white text-3xl font-black shadow-2xl overflow-hidden">
                {avatarPreview ? (
                  <Image src={avatarPreview} alt="Avatar" fill unoptimized sizes="128px" className="object-cover" />
                ) : (
                  (formData.name || 'U').slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="absolute inset-0 bg-black/40 rounded-[40px] opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center border-4 border-white/0 group-hover:border-white/20">
                <Camera className="w-8 h-8 text-white" />
              </div>
            </div>
            <input
              ref={avatarFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarSelect}
            />
          </div>

          <div className="p-8 space-y-8">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-black font-black text-xs uppercase tracking-widest ml-1">
                <User size={14} /> Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                className="w-full px-5 py-4 bg-zinc-50 border-2 border-transparent rounded-2xl text-black text-[15px] font-bold placeholder-zinc-300 focus:outline-none focus:border-black focus:bg-white transition-all"
                placeholder="Enter your name"
              />
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-black font-black text-xs uppercase tracking-widest ml-1">
                <AlignLeft size={14} /> Bio
              </label>
              <textarea
                value={formData.bio}
                onChange={(event) => setFormData({ ...formData, bio: event.target.value })}
                className="w-full px-5 py-4 bg-zinc-50 border-2 border-transparent rounded-2xl text-black text-[15px] font-bold placeholder-zinc-300 focus:outline-none focus:border-black focus:bg-white transition-all min-h-[120px] resize-none"
                placeholder="Tell your gaming story"
              />
              <div className="flex justify-end pr-2">
                <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">
                  {formData.bio.length} / 160
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-black font-black text-xs uppercase tracking-widest ml-1">
                  <MapPin size={14} /> Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(event) => setFormData({ ...formData, location: event.target.value })}
                  className="w-full px-5 py-4 bg-zinc-50 border-2 border-transparent rounded-2xl text-black text-[15px] font-bold focus:outline-none focus:border-black focus:bg-white transition-all"
                />
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-black font-black text-xs uppercase tracking-widest ml-1">
                  <Globe size={14} /> Website
                </label>
                <input
                  type="text"
                  value={formData.website}
                  onChange={(event) => setFormData({ ...formData, website: event.target.value })}
                  className="w-full px-5 py-4 bg-zinc-50 border-2 border-transparent rounded-2xl text-black text-[15px] font-bold focus:outline-none focus:border-black focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
