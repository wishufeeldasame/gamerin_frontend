'use client';

import { useToast } from '@/app/context/ToastContext';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Hash, ImagePlus, Upload, Video, X } from 'lucide-react';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuth } from '@/app/context/AuthContext';
import { getInitials } from '@/lib/feed-api';
import type { PostDraft } from '@/hooks/usePendingPosts';
import { fetchHashtagSuggestions, type HashtagSummary } from '@/lib/community-search-api';
import { convertImageForUpload, convertImagesForUpload, isHeicFile } from '@/lib/profile-image-compression';

interface PostComposerProps {
  onSubmit?: (draft: PostDraft) => void;
}

interface ThumbnailOption {
  id: string;
  file: File;
  previewUrl: string;
  label: string;
  kind: 'generated' | 'uploaded';
}

const MAX_IMAGE_COUNT = 4;
const MAX_IMAGE_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_THUMBNAILS: number = 4;
const MAX_VIDEO_COUNT = 1;
const MAX_VIDEO_FILE_SIZE_BYTES = 500 * 1024 * 1024;
const MAX_VIDEO_DURATION_SECONDS = 120;
export const MAX_POST_CONTENT_LENGTH = 1000;
const MAX_THUMBNAIL_CANVAS_WIDTH = 1280;
const MAX_THUMBNAIL_CANVAS_HEIGHT = 720;

type ActiveHashtagQuery = {
  query: string;
  start: number;
  end: number;
};

function isImageFile(file: File) {
  const type = file.type.toLowerCase();
  return type === 'image/jpeg' || type === 'image/png' || /\.(jpe?g|png)$/i.test(file.name) || isHeicFile(file);
}

function isVideoFile(file: File) {
  return file.type.startsWith('video/') || /\.(mp4|mov|m4v)$/i.test(file.name);
}

function makeObjectUrl(file: File) {
  return URL.createObjectURL(file);
}

function revokeUrl(url: string | null) {
  if (url) {
    URL.revokeObjectURL(url);
  }
}

function revokeThumbnailOptions(options: ThumbnailOption[]) {
  options.forEach((option) => revokeUrl(option.previewUrl));
}

function buildThumbnailOption(file: File, label: string, kind: ThumbnailOption['kind']): ThumbnailOption {
  return {
    id: `${kind}-${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    previewUrl: makeObjectUrl(file),
    label,
    kind,
  };
}

function getThumbnailCanvasSize(video: HTMLVideoElement) {
  const sourceWidth = video.videoWidth || MAX_THUMBNAIL_CANVAS_WIDTH;
  const sourceHeight = video.videoHeight || MAX_THUMBNAIL_CANVAS_HEIGHT;
  const scale = Math.min(MAX_THUMBNAIL_CANVAS_WIDTH / sourceWidth, MAX_THUMBNAIL_CANVAS_HEIGHT / sourceHeight, 1);

  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

async function waitForVideoEvent(video: HTMLVideoElement, eventName: 'loadedmetadata' | 'seeked') {
  await new Promise<void>((resolve, reject) => {
    const onSuccess = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error(`동영상 ${eventName} 이벤트 처리에 실패했습니다.`));
    };

    const cleanup = () => {
      video.removeEventListener(eventName, onSuccess);
      video.removeEventListener('error', onError);
    };

    video.addEventListener(eventName, onSuccess, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
}

async function createThumbnailFile(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  timeInSeconds: number,
  index: number,
  baseName: string
) {
  video.currentTime = timeInSeconds;
  await waitForVideoEvent(video, 'seeked');

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('이미지 처리 기능을 사용할 수 없습니다.');
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), 'image/jpeg', 0.92);
  });

  if (!blob) {
    throw new Error('썸네일 생성에 실패했습니다.');
  }

  return new File([blob], `${baseName}-thumbnail-${index + 1}.jpg`, { type: 'image/jpeg' });
}

async function generateThumbnailOptions(file: File) {
  const objectUrl = makeObjectUrl(file);

  try {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    await waitForVideoEvent(video, 'loadedmetadata');

    const canvas = document.createElement('canvas');
    const canvasSize = getThumbnailCanvasSize(video);
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    if (duration > MAX_VIDEO_DURATION_SECONDS) {
      throw new Error('동영상 길이는 2분 이하여야 합니다.');
    }

    const sampleTimes = Array.from({ length: MAX_VIDEO_THUMBNAILS }, (_, index) => {
      const ratio = MAX_VIDEO_THUMBNAILS === 1 ? 0 : index / (MAX_VIDEO_THUMBNAILS - 1);
      return Math.min(Math.max(duration * ratio, 0), Math.max(duration - 0.1, 0));
    });

    const uniqueTimes = sampleTimes.filter(
      (time, index, allTimes) => allTimes.findIndex((item) => Math.abs(item - time) < 0.05) === index
    );

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'video';
    const options: ThumbnailOption[] = [];

    for (let index = 0; index < uniqueTimes.length; index += 1) {
      const thumbnailFile = await createThumbnailFile(video, canvas, uniqueTimes[index], index, baseName);
      options.push(buildThumbnailOption(thumbnailFile, index === 0 ? '기본' : `옵션 ${index + 1}`, 'generated'));
    }

    return options;
  } finally {
    revokeUrl(objectUrl);
  }
}

export function PostComposer({ onSubmit }: PostComposerProps) {
  const toast = useToast();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const contentTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement | null>(null);

  const [content, setContent] = useState('');
  // 한 번 포커스하면 게시·초기화 전까지 펼친 채 둔다. blur로 접으면 툴바 버튼이 클릭 도중 움직인다.
  const [expanded, setExpanded] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [thumbnailOptions, setThumbnailOptions] = useState<ThumbnailOption[]>([]);
  const [selectedThumbnailId, setSelectedThumbnailId] = useState<string | null>(null);
  const [generatingThumbnails, setGeneratingThumbnails] = useState(false);
  const [preparingImages, setPreparingImages] = useState(false);
  // 변환 중에 선택이 바뀌면 늦게 끝난 변환 결과를 버린다.
  const imageSelectionSeqRef = useRef(0);
  const [preparingThumbnail, setPreparingThumbnail] = useState(false);
  const thumbnailUploadSeqRef = useRef(0);
  const [activeHashtagQuery, setActiveHashtagQuery] = useState<ActiveHashtagQuery | null>(null);
  const [hashtagSuggestions, setHashtagSuggestions] = useState<HashtagSummary[]>([]);
  const [loadingHashtagSuggestions, setLoadingHashtagSuggestions] = useState(false);

  const hasFiles = imageFiles.length > 0 || Boolean(videoFile);
  const selectedThumbnail = thumbnailOptions.find((option) => option.id === selectedThumbnailId) ?? null;

  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach((url) => revokeUrl(url));
    };
  }, [imagePreviewUrls]);

  useEffect(() => {
    return () => {
      revokeUrl(videoPreviewUrl);
    };
  }, [videoPreviewUrl]);

  useEffect(() => {
    return () => {
      revokeThumbnailOptions(thumbnailOptions);
    };
  }, [thumbnailOptions]);

  useEffect(() => {
    if (!activeHashtagQuery?.query) {
      setHashtagSuggestions([]);
      setLoadingHashtagSuggestions(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setLoadingHashtagSuggestions(true);
        const suggestions = await fetchHashtagSuggestions(activeHashtagQuery.query, 10, {
          signal: controller.signal,
        });
        if (!cancelled) {
          setHashtagSuggestions(suggestions);
        }
      } catch (suggestionError) {
        if (suggestionError instanceof DOMException && suggestionError.name === 'AbortError') {
          return;
        }

        if (!cancelled) {
          setHashtagSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingHashtagSuggestions(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [activeHashtagQuery]);

  const clearThumbnailSelection = () => {
    setThumbnailOptions([]);
    setSelectedThumbnailId(null);
    if (thumbnailInputRef.current) {
      thumbnailInputRef.current.value = '';
    }
  };

  const clearImageSelection = () => {
    imageSelectionSeqRef.current += 1;
    setPreparingImages(false);
    setImageFiles([]);
    setImagePreviewUrls([]);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const clearVideoSelection = () => {
    thumbnailUploadSeqRef.current += 1;
    setPreparingThumbnail(false);
    setVideoFile(null);
    setVideoPreviewUrl(null);
    clearThumbnailSelection();
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  const clearAttachments = () => {
    clearImageSelection();
    clearVideoSelection();
  };

  const resetComposer = () => {
    setContent('');
    setExpanded(false);
    setActiveHashtagQuery(null);
    setHashtagSuggestions([]);
    clearAttachments();
  };

  const updateActiveHashtagQuery = (value: string, caretPosition: number | null) => {
    if (caretPosition === null) {
      setActiveHashtagQuery(null);
      return;
    }

    const beforeCaret = value.slice(0, caretPosition);
    const match = beforeCaret.match(/(^|\s)#([\p{L}\p{N}_]{1,50})$/u);

    if (!match || match.index === undefined) {
      setActiveHashtagQuery(null);
      return;
    }

    const prefixLength = match[1]?.length ?? 0;
    setActiveHashtagQuery({
      query: match[2] ?? '',
      start: match.index + prefixLength,
      end: caretPosition,
    });
  };

  const handleContentChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextContent = event.target.value;
    setContent(nextContent);
    updateActiveHashtagQuery(nextContent, event.target.selectionStart);
  };

  const handleSelectHashtagSuggestion = (name: string) => {
    if (!activeHashtagQuery) {
      return;
    }

    const replacement = `#${name}`;
    const nextContent = `${content.slice(0, activeHashtagQuery.start)}${replacement}${content.slice(
      activeHashtagQuery.end,
    )}`;
    const nextCaretPosition = activeHashtagQuery.start + replacement.length;

    setContent(nextContent);
    setActiveHashtagQuery(null);
    setHashtagSuggestions([]);

    window.requestAnimationFrame(() => {
      contentTextareaRef.current?.focus();
      contentTextareaRef.current?.setSelectionRange(nextCaretPosition, nextCaretPosition);
    });
  };

  const handleInsertHashtag = () => {
    const textarea = contentTextareaRef.current;
    const start = textarea?.selectionStart ?? content.length;
    const end = textarea?.selectionEnd ?? content.length;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const prefix = before === '' || /\s$/.test(before) ? '#' : ' #';
    // 뒤 글자가 태그 문자면 띄워서 기존 단어가 새 태그에 붙지 않게 한다.
    const insert = /^[\p{L}\p{N}_]/u.test(after) ? `${prefix} ` : prefix;
    if (content.length - (end - start) + insert.length > MAX_POST_CONTENT_LENGTH) return;

    const nextCaretPosition = start + prefix.length;
    const nextContent = `${before}${insert}${after}`;
    setContent(nextContent);
    updateActiveHashtagQuery(nextContent, nextCaretPosition);
    setExpanded(true);
    window.requestAnimationFrame(() => {
      contentTextareaRef.current?.focus();
      contentTextareaRef.current?.setSelectionRange(nextCaretPosition, nextCaretPosition);
    });
  };

  const handleImageSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length > MAX_IMAGE_COUNT) {
      toast.error(`이미지는 최대 ${MAX_IMAGE_COUNT}개까지 업로드할 수 있습니다.`);
    }

    const files = selectedFiles.slice(0, MAX_IMAGE_COUNT);
    if (files.some((file) => !isImageFile(file))) {
      toast.error('사진에는 JPEG 또는 PNG 파일만 업로드할 수 있습니다.');
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      return;
    }

    const seq = ++imageSelectionSeqRef.current;
    setPreparingImages(true);
    try {
      // HEIC·회전·고해상도(48MP) 사진을 서버가 받는 JPEG로 맞춘 뒤 크기를 검사한다.
      const converted = await convertImagesForUpload(files);
      if (seq !== imageSelectionSeqRef.current) {
        return;
      }

      if (converted.some((file) => file.size > MAX_IMAGE_FILE_SIZE_BYTES)) {
        toast.error('사진 파일은 장당 20MB 이하여야 합니다.');
        if (imageInputRef.current) {
          imageInputRef.current.value = '';
        }
        return;
      }

      clearVideoSelection();
      setImageFiles(converted);
      setImagePreviewUrls(converted.map((file) => makeObjectUrl(file)));
    } catch (error) {
      if (seq !== imageSelectionSeqRef.current) {
        return;
      }
      toast.error(error instanceof Error ? error.message : '사진을 준비하지 못했습니다.');
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    } finally {
      if (seq === imageSelectionSeqRef.current) {
        setPreparingImages(false);
      }
    }
  };

  const handleVideoSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length > MAX_VIDEO_COUNT) {
      toast.error('동영상은 하나만 업로드할 수 있습니다.');
    }

    const selected = selectedFiles[0] ?? null;
    clearImageSelection();
    clearVideoSelection();

    if (!selected) {
      return;
    }

    if (!isVideoFile(selected)) {
      toast.error('동영상 파일만 업로드할 수 있습니다.');
      return;
    }

    if (selected.size > MAX_VIDEO_FILE_SIZE_BYTES) {
      toast.error('동영상 파일은 500MB 이하여야 합니다.');
      return;
    }

    setVideoFile(selected);
    setVideoPreviewUrl(makeObjectUrl(selected));
    setGeneratingThumbnails(true);

    try {
      const options = await generateThumbnailOptions(selected);
      setThumbnailOptions(options);
      setSelectedThumbnailId(null);
    } catch (error) {
      clearVideoSelection();
      toast.error(error instanceof Error ? error.message : '동영상 미리보기를 준비하지 못했습니다.');
    } finally {
      setGeneratingThumbnails(false);
    }
  };

  const handleThumbnailUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    if (!selected) {
      return;
    }

    if (!isImageFile(selected)) {
      toast.error('동영상 썸네일은 JPEG 또는 PNG 파일이어야 합니다.');
      if (thumbnailInputRef.current) {
        thumbnailInputRef.current.value = '';
      }
      return;
    }

    const seq = ++thumbnailUploadSeqRef.current;
    setPreparingThumbnail(true);
    let file: File;
    try {
      file = await convertImageForUpload(selected);
    } catch (error) {
      if (seq === thumbnailUploadSeqRef.current) {
        setPreparingThumbnail(false);
        toast.error(error instanceof Error ? error.message : '썸네일을 준비하지 못했습니다.');
        if (thumbnailInputRef.current) {
          thumbnailInputRef.current.value = '';
        }
      }
      return;
    }
    // 변환 중 동영상이 바뀌었으면 이전 동영상의 썸네일을 붙이지 않는다.
    if (seq !== thumbnailUploadSeqRef.current) {
      return;
    }
    setPreparingThumbnail(false);

    if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
      toast.error('동영상 썸네일은 20MB 이하여야 합니다.');
      if (thumbnailInputRef.current) {
        thumbnailInputRef.current.value = '';
      }
      return;
    }

    const uploadedOption = buildThumbnailOption(file, '직접 업로드', 'uploaded');
    setThumbnailOptions((current) => [...current.filter((option) => option.kind !== 'uploaded'), uploadedOption]);
    setSelectedThumbnailId(uploadedOption.id);
  };

  const canSubmit =
    Boolean(user) &&
    !generatingThumbnails &&
    !preparingImages &&
    !preparingThumbnail &&
    Boolean(content.trim() || imageFiles.length > 0 || videoFile);

  const handleSubmit = () => {
    if (!requireAuth('게시글을 작성하려면 로그인이 필요해요.')) return;
    if (!canSubmit) {
      return;
    }

    // 작성창은 바로 비우고 업로드는 피드의 임시 카드가 이어받는다.
    onSubmit?.({
      content: content.trim(),
      imageFiles,
      videoFile,
      thumbnailFile: videoFile ? selectedThumbnail?.file ?? null : null,
    });
    resetComposer();
  };

  const open = expanded || content.length > 0 || hasFiles || preparingImages;
  if (!user) {
    return (
      <section className="rounded-card border border-line-card bg-surface p-3 md:p-4">
        <button type="button" className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-body text-fg-tertiary focus-visible:outline-2 focus-visible:outline-fg-brand dark:focus-visible:outline-line-focus" onClick={() => requireAuth('게시글을 작성하려면 로그인이 필요해요.')}>
          <span>로그인 후 게시글을 작성할 수 있습니다.</span>
          <span className="btn-primary shrink-0">게시</span>
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-line-card bg-surface p-3 transition-colors focus-within:border-line-focus md:p-4">
      <div className={`flex flex-wrap gap-x-3 ${open ? 'gap-y-3' : 'items-center gap-y-1'}`}>
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-subtle text-label text-fg-secondary">
          {user?.profileImageUrl ? (
            <Image src={user.profileImageUrl} alt="" fill unoptimized sizes="40px" className="object-cover" />
          ) : (
            getInitials(user?.nickname ?? '', 'U')
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
        <textarea
          ref={contentTextareaRef}
          value={content}
          rows={1}
          onFocus={() => setExpanded(true)}
          onChange={handleContentChange}
          onClick={(event) => updateActiveHashtagQuery(content, event.currentTarget.selectionStart)}
          onKeyUp={(event) => updateActiveHashtagQuery(content, event.currentTarget.selectionStart)}
          maxLength={MAX_POST_CONTENT_LENGTH}
          aria-label="게시글 내용"
          placeholder={user ? '무슨 생각을 하고 있나요?' : '로그인 후 게시글을 작성할 수 있습니다.'}
          className={`block w-full resize-none !bg-transparent py-2 text-body text-fg-primary outline-none placeholder:text-fg-tertiary ${
            open ? 'min-h-20' : 'h-10'
          }`}
        />
        {activeHashtagQuery ? (
          <div className="max-w-xs overflow-hidden rounded-control bg-surface-elevated shadow-xl ring-1 ring-line">
            <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-caption text-fg-tertiary">
              <Hash size={14} strokeWidth={1.67} />
              <span>#{activeHashtagQuery.query}</span>
            </div>

            {loadingHashtagSuggestions ? (
              <div className="px-3 py-3 text-label text-fg-tertiary">해시태그를 찾는 중...</div>
            ) : hashtagSuggestions.length > 0 ? (
              <div className="max-h-48 overflow-y-auto p-1">
                {hashtagSuggestions.map((hashtag) => (
                  <button
                    key={hashtag.hashtagId}
                    type="button"
                    onClick={() => handleSelectHashtagSuggestion(hashtag.name)}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition hover:bg-subtle"
                  >
                    <span className="text-label font-bold text-fg-primary">#{hashtag.name}</span>
                    <span className="text-caption text-fg-tertiary">
                      게시글 {hashtag.postCount.toLocaleString()}개
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-3 py-3 text-label text-fg-tertiary">일치하는 해시태그가 없습니다.</div>
            )}
          </div>
        ) : null}

        {videoPreviewUrl ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-control bg-black">
              <video
                controls
                playsInline
                src={videoPreviewUrl}
                poster={selectedThumbnail?.previewUrl ?? undefined}
                className="aspect-video w-full bg-black object-contain"
              />
            </div>

            <div className="rounded-control bg-subtle p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-label font-bold text-fg-primary">썸네일 선택</p>
                  <p className="text-caption text-fg-secondary">생성된 썸네일을 고르거나 직접 올릴 수 있습니다.</p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedThumbnailId(null)}
                    aria-pressed={selectedThumbnailId === null}
                    className={`h-8 rounded-control px-3 text-label transition ${
                      selectedThumbnailId === null
                        ? 'bg-inverse text-canvas'
                        : 'bg-surface text-fg-secondary hover:text-fg-primary'
                    }`}
                  >
                    썸네일 없음
                  </button>

                  <button
                    type="button"
                    onClick={() => thumbnailInputRef.current?.click()}
                    className="inline-flex h-8 items-center gap-1.5 rounded-control bg-surface px-3 text-label text-fg-secondary transition hover:text-fg-primary"
                  >
                    <Upload size={14} />
                    업로드
                  </button>
                </div>
              </div>

              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                className="hidden"
                onChange={handleThumbnailUpload}
              />

              {generatingThumbnails ? (
                <div className="rounded-control bg-surface px-4 py-4 text-label text-fg-secondary">
                  썸네일 후보를 준비하고 있습니다...
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {thumbnailOptions.map((option) => {
                    const isSelected = option.id === selectedThumbnailId;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedThumbnailId(option.id)}
                        aria-pressed={isSelected}
                        className={`shrink-0 overflow-hidden rounded-control border-2 bg-surface text-left transition ${
                          isSelected ? 'border-line-focus' : 'border-transparent hover:border-line-strong'
                        }`}
                      >
                        <div className="h-16 w-28 bg-subtle">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={option.previewUrl} alt={option.label} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                          <span className="text-caption text-fg-primary">{option.label}</span>
                          {option.kind === 'uploaded' ? (
                            <span className="rounded-full bg-subtle px-1.5 py-0.5 text-2xs font-medium text-fg-secondary">
                              직접 선택
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {preparingImages ? (
          <div role="status" className="rounded-control bg-subtle px-4 py-4 text-label text-fg-secondary">
            사진을 준비하고 있습니다...
          </div>
        ) : null}

        {imagePreviewUrls.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {imagePreviewUrls.map((url, index) => (
              <div key={url} className="overflow-hidden rounded-control bg-subtle">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`선택한 이미지 ${index + 1}`} className="aspect-square w-full object-cover" />
              </div>
            ))}
          </div>
        ) : null}
        </div>

        <div className={`flex flex-wrap items-center gap-x-1 gap-y-2 ${open ? 'w-full border-t border-line pt-3' : 'w-full pl-[52px] md:w-auto md:pl-0'}`}>
          <input
            ref={imageInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            className="hidden"
            onChange={handleImageSelect}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/x-m4v,.mp4,.mov,.m4v"
            className="hidden"
            onChange={handleVideoSelect}
          />

          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            aria-label="동영상 추가"
            title="동영상 추가"
            className="btn-icon -ml-2"
          >
            <Video size={20} strokeWidth={1.67} />
          </button>

          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            aria-label="사진 추가"
            title="사진 추가"
            className="btn-icon"
          >
            <ImagePlus size={20} strokeWidth={1.67} />
          </button>

          <button
            type="button"
            onClick={handleInsertHashtag}
            disabled={!user}
            aria-label="해시태그 추가"
            title="해시태그 추가"
            className="btn-icon"
          >
            <Hash size={20} strokeWidth={1.67} />
          </button>

          {hasFiles ? (
            <button type="button" onClick={clearAttachments} aria-label="첨부 지우기" title="첨부 지우기" className="btn-icon">
              <X size={20} strokeWidth={1.67} />
            </button>
          ) : null}

          <div className="ml-auto flex items-center gap-3 pl-2">
            {content.length > 0 ? (
              <span
                className={`text-caption tabular-nums ${
                  content.length >= MAX_POST_CONTENT_LENGTH ? 'text-fg-danger' : 'text-fg-tertiary'
                }`}
              >
                {content.length} / {MAX_POST_CONTENT_LENGTH}
              </span>
            ) : null}

            <button type="button" disabled={!canSubmit} onClick={handleSubmit} className="btn-primary">
              게시
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
