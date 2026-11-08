'use client';

import { useToast } from '@/app/context/ToastContext';

import Image from 'next/image';
import { X, Camera, MapPin, Globe, AlignLeft, User } from 'lucide-react';
import { useState, useRef, useEffect, type ChangeEvent, type MutableRefObject } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { compressProfileImage } from '@/lib/profile-image-compression';
import { DEFAULT_PROFILE_COVER } from '@/lib/profile-constants';
import { getInitials } from '@/lib/feed-api';
import { useEscapeKey } from '@/hooks/useEscapeKey';

export interface EditProfileUserInfo {
  name: string;
  bio: string;
  location: string;
  website: string;
  coverImageUrl: string;
  profileImageUrl: string | null;
  coverImageFile: File | null;
  profileImageFile: File | null;
}

interface EditProfileModalProps {
  onClose: () => void;
  coverImage: string | null;
  onSaveCover?: (coverUrl: string) => void;
  avatarImage: string | null;
  onSaveAvatar?: (avatarUrl: string | null) => void;
  userInfo?: {
    name: string;
    bio: string;
    location: string;
    website: string;
  };
  onSaveUserInfo?: (userInfo: EditProfileUserInfo) => void | Promise<void>;
}

const PROFILE_FIELD_LIMITS = {
  nameMin: 2,
  nameMax: 20,
  bioMax: 160,
  locationMax: 100,
  websiteMax: 2048,
};

function normalizeWebsiteInput(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return '';
  }

  return /^https?:\/\//i.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`;
}

function validateProfileInput(userInfo: EditProfileUserInfo) {
  if (
    userInfo.name.length < PROFILE_FIELD_LIMITS.nameMin ||
    userInfo.name.length > PROFILE_FIELD_LIMITS.nameMax
  ) {
    throw new Error('닉네임은 2~20자 사이여야 합니다.');
  }

  if (userInfo.bio.length > PROFILE_FIELD_LIMITS.bioMax) {
    throw new Error('소개글은 160자를 초과할 수 없습니다.');
  }

  if (userInfo.location.length > PROFILE_FIELD_LIMITS.locationMax) {
    throw new Error('지역은 100자를 초과할 수 없습니다.');
  }

  if (userInfo.website.length > PROFILE_FIELD_LIMITS.websiteMax) {
    throw new Error('웹사이트 주소는 2048자를 초과할 수 없습니다.');
  }

  if (userInfo.website) {
    try {
      const websiteUrl = new URL(userInfo.website);
      if (!['http:', 'https:'].includes(websiteUrl.protocol)) {
        throw new Error();
      }
    } catch {
      throw new Error('웹사이트 주소를 올바른 URL로 입력해 주세요.');
    }
  }
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
  const toast = useToast();
  useEscapeKey(onClose);
  const [formData, setFormData] = useState({
    name: userInfo?.name || '',
    bio: userInfo?.bio || '',
    location: userInfo?.location || '',
    website: userInfo?.website || '',
  });
  const [coverPreview, setCoverPreview] = useState<string>(coverImage || DEFAULT_PROFILE_COVER);
  const isDefaultCover = coverPreview === DEFAULT_PROFILE_COVER;
  const [avatarPreview, setAvatarPreview] = useState<string | null>(avatarImage);
  const [saving, setSaving] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [avatarImageFile, setAvatarImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const coverObjectUrlRef = useRef<string | null>(null);
  const avatarObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    revokeObjectUrl(coverObjectUrlRef);
    setCoverImageFile(null);
    setCoverPreview(coverImage || DEFAULT_PROFILE_COVER);
  }, [coverImage]);

  useEffect(() => {
    revokeObjectUrl(avatarObjectUrlRef);
    setAvatarImageFile(null);
    setAvatarPreview(avatarImage);
  }, [avatarImage]);

  useEffect(() => {
    return () => {
      revokeObjectUrl(coverObjectUrlRef);
      revokeObjectUrl(avatarObjectUrlRef);
    };
  }, []);

  const revokeObjectUrl = (urlRef: MutableRefObject<string | null>) => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  };

  const handleCoverClick = () => {
    fileInputRef.current?.click();
  };

  const handleCoverSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setProcessingImage(true);
      const compressedFile = await compressProfileImage(file, 'COVER');
      const previewUrl = URL.createObjectURL(compressedFile);
      revokeObjectUrl(coverObjectUrlRef);
      coverObjectUrlRef.current = previewUrl;
      setCoverImageFile(compressedFile);
      setCoverPreview(previewUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '커버 이미지를 처리하지 못했습니다.');
    } finally {
      setProcessingImage(false);
      event.target.value = '';
    }
  };

  const handleAvatarClick = () => {
    avatarFileInputRef.current?.click();
  };

  const handleAvatarSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setProcessingImage(true);
      const compressedFile = await compressProfileImage(file, 'PROFILE');
      const previewUrl = URL.createObjectURL(compressedFile);
      revokeObjectUrl(avatarObjectUrlRef);
      avatarObjectUrlRef.current = previewUrl;
      setAvatarImageFile(compressedFile);
      setAvatarPreview(previewUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '프로필 이미지를 처리하지 못했습니다.');
    } finally {
      setProcessingImage(false);
      event.target.value = '';
    }
  };

  const handleResetCover = () => {
    revokeObjectUrl(coverObjectUrlRef);
    setCoverImageFile(null);
    setCoverPreview(DEFAULT_PROFILE_COVER);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (saving || processingImage) return;

    try {
      const nextUserInfo: EditProfileUserInfo = {
        name: formData.name.trim(),
        bio: formData.bio.trim(),
        location: formData.location.trim(),
        website: normalizeWebsiteInput(formData.website),
        coverImageUrl: coverImageFile || coverPreview === DEFAULT_PROFILE_COVER ? '' : coverPreview,
        profileImageUrl: avatarImageFile ? null : avatarPreview,
        coverImageFile,
        profileImageFile: avatarImageFile,
      };

      validateProfileInput(nextUserInfo);
      setSaving(true);
      await onSaveUserInfo?.(nextUserInfo);
      onSaveCover?.(coverPreview);
      onSaveAvatar?.(avatarPreview);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '프로필을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="modal-overlay z-[110] !bg-transparent">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-profile-title"
          className="modal-panel relative overflow-y-auto pb-[env(safe-area-inset-bottom)] lg:max-w-[560px]"
        >
          <div aria-hidden="true" className="modal-handle" />
          <div className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-line bg-surface px-5 py-3 lg:px-6">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={onClose}
                aria-label="닫기"
                className="btn-icon"
              >
                <X size={24} />
              </button>
              <h2 id="edit-profile-title" className="text-title text-fg-primary">프로필 수정</h2>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || processingImage}
              className="btn-primary"
            >
              {processingImage ? '이미지 처리 중...' : saving ? '저장 중...' : '저장'}
            </button>
          </div>

          <div className={`relative h-36 bg-inverse group overflow-hidden ${isDefaultCover ? 'dark:bg-surface-elevated' : ''}`}>
            <Image
              src={coverPreview}
              alt="커버 이미지"
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 768px"
              className={`object-cover opacity-60 group-hover:scale-105 transition-transform duration-700 ${isDefaultCover ? 'dark:hidden' : ''}`}
            />
            <button type="button" aria-label="커버 이미지 변경" onClick={handleCoverClick} className={`absolute inset-0 flex cursor-pointer items-center justify-center bg-black/20 group-hover:bg-black/40 transition-all focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-line-focus ${isDefaultCover ? 'dark:bg-transparent dark:group-hover:bg-black/20' : ''}`}>
              <span className="flex flex-col items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-control border border-white/30 bg-white/20 text-white">
                  <Camera size={24} />
                </span>
                <span className="text-white text-xs font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 transition-opacity">
                  커버 이미지 변경
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleResetCover();
              }}
              className="btn-secondary absolute bottom-3 right-3"
            >
              커버 이미지 초기화
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handleCoverSelect}
            />
          </div>

          <div className="px-5 -mt-10 relative z-10 lg:px-6">
            <button type="button" aria-label="프로필 이미지 변경" className="relative block h-24 w-24 group cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-line-focus" onClick={handleAvatarClick}>
              <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border-4 border-surface bg-subtle text-title text-fg-secondary">
                {avatarPreview ? (
                  <Image src={avatarPreview} alt="프로필 이미지" fill unoptimized sizes="128px" className="object-cover" />
                ) : (
                  getInitials(formData.name, 'U')
                )}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/0 transition-colors group-hover:bg-black/30" />
              {/* 이니셜과 겹치지 않도록 카메라는 모서리 배지로 둔다. */}
              <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-subtle text-fg-primary">
                <Camera size={16} />
              </div>
            </button>
            <input
              ref={avatarFileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handleAvatarSelect}
            />
          </div>

          <div className="p-5 space-y-4 lg:p-6">
            <div className="space-y-2">
              <label htmlFor="edit-profile-name" className="flex items-center gap-2 text-label text-fg-secondary">
                <User size={14} /> 닉네임
              </label>
              <input
                id="edit-profile-name"
                type="text"
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                maxLength={PROFILE_FIELD_LIMITS.nameMax}
                className="input-base"
                placeholder="닉네임을 입력하세요"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="edit-profile-bio" className="flex items-center gap-2 text-label text-fg-secondary">
                <AlignLeft size={14} /> 자기소개
              </label>
              <textarea
                id="edit-profile-bio"
                value={formData.bio}
                onChange={(event) => setFormData({ ...formData, bio: event.target.value })}
                maxLength={PROFILE_FIELD_LIMITS.bioMax}
                className="input-base min-h-24 resize-none py-3"
                placeholder="나를 소개해 보세요"
              />
              <div className="flex justify-end pr-2">
                <span className="text-caption text-fg-tertiary">
                  {formData.bio.length} / 160
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="edit-profile-location" className="flex items-center gap-2 text-label text-fg-secondary">
                  <MapPin size={14} /> 지역
                </label>
                <input
                  id="edit-profile-location"
                  type="text"
                  value={formData.location}
                  onChange={(event) => setFormData({ ...formData, location: event.target.value })}
                  maxLength={PROFILE_FIELD_LIMITS.locationMax}
                  className="input-base"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="edit-profile-website" className="flex items-center gap-2 text-label text-fg-secondary">
                  <Globe size={14} /> 웹사이트
                </label>
                <input
                  id="edit-profile-website"
                  type="text"
                  value={formData.website}
                  onChange={(event) => setFormData({ ...formData, website: event.target.value })}
                  maxLength={PROFILE_FIELD_LIMITS.websiteMax}
                  className="input-base"
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
