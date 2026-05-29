'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { ImagePlus, Smile, Upload, Video, X } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { PostRecord, createJsonPost, createMultipartPost, getInitials } from '@/lib/feed-api';

interface PostComposerProps {
  onCreated?: (post: PostRecord) => void;
}

interface ThumbnailOption {
  id: string;
  file: File;
  previewUrl: string;
  label: string;
  kind: 'generated' | 'uploaded';
}

const MAX_IMAGE_COUNT = 4;
const MAX_VIDEO_THUMBNAILS = 4;
const MAX_VIDEO_COUNT = 1;
const MAX_VIDEO_FILE_SIZE_BYTES = 500 * 1024 * 1024;
const MAX_VIDEO_DURATION_SECONDS = 120;

function isImageFile(file: File) {
  return file.type.startsWith('image/') || /\.(jpe?g|png|gif|webp)$/i.test(file.name);
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

async function waitForVideoEvent(video: HTMLVideoElement, eventName: 'loadedmetadata' | 'seeked') {
  await new Promise<void>((resolve, reject) => {
    const onSuccess = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error(`Video ${eventName} failed.`));
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
    throw new Error('Canvas is unavailable.');
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), 'image/jpeg', 0.92);
  });

  if (!blob) {
    throw new Error('Thumbnail generation failed.');
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
    canvas.width = Math.max(video.videoWidth || 1280, 320);
    canvas.height = Math.max(video.videoHeight || 720, 180);

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    if (duration > MAX_VIDEO_DURATION_SECONDS) {
      throw new Error('Video duration must be 2 minutes or shorter.');
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
      options.push(buildThumbnailOption(thumbnailFile, index === 0 ? 'Default' : `Option ${index + 1}`, 'generated'));
    }

    return options;
  } finally {
    revokeUrl(objectUrl);
  }
}

export function PostComposer({ onCreated }: PostComposerProps) {
  const { user } = useAuth();
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement | null>(null);

  const [content, setContent] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [thumbnailOptions, setThumbnailOptions] = useState<ThumbnailOption[]>([]);
  const [selectedThumbnailId, setSelectedThumbnailId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generatingThumbnails, setGeneratingThumbnails] = useState(false);

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

  const clearThumbnailSelection = () => {
    setThumbnailOptions([]);
    setSelectedThumbnailId(null);
    if (thumbnailInputRef.current) {
      thumbnailInputRef.current.value = '';
    }
  };

  const clearImageSelection = () => {
    setImageFiles([]);
    setImagePreviewUrls([]);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const clearVideoSelection = () => {
    setVideoFile(null);
    setVideoPreviewUrl(null);
    clearThumbnailSelection();
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  const resetComposer = () => {
    setContent('');
    clearImageSelection();
    clearVideoSelection();
  };

  const handleImageSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length > MAX_IMAGE_COUNT) {
      alert(`You can upload up to ${MAX_IMAGE_COUNT} images.`);
    }

    const files = selectedFiles.slice(0, MAX_IMAGE_COUNT);
    if (files.some((file) => !isImageFile(file))) {
      alert('Only image files can be uploaded as photos.');
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      return;
    }

    clearVideoSelection();
    setImageFiles(files);
    setImagePreviewUrls(files.map((file) => makeObjectUrl(file)));
  };

  const handleVideoSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length > MAX_VIDEO_COUNT) {
      alert('You can upload only one video.');
    }

    const selected = selectedFiles[0] ?? null;
    clearImageSelection();
    clearVideoSelection();

    if (!selected) {
      return;
    }

    if (!isVideoFile(selected)) {
      alert('Only video files can be uploaded as videos.');
      return;
    }

    if (selected.size > MAX_VIDEO_FILE_SIZE_BYTES) {
      alert('Video file must be 500MB or smaller.');
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
      alert(error instanceof Error ? error.message : 'Failed to prepare video preview.');
    } finally {
      setGeneratingThumbnails(false);
    }
  };

  const handleThumbnailUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }

    if (!isImageFile(file)) {
      alert('Video thumbnail must be an image file.');
      if (thumbnailInputRef.current) {
        thumbnailInputRef.current.value = '';
      }
      return;
    }

    const uploadedOption = buildThumbnailOption(file, 'Uploaded', 'uploaded');
    setThumbnailOptions((current) => [...current.filter((option) => option.kind !== 'uploaded'), uploadedOption]);
    setSelectedThumbnailId(uploadedOption.id);
  };

  const canSubmit =
    Boolean(user) &&
    !submitting &&
    !generatingThumbnails &&
    Boolean(content.trim() || imageFiles.length > 0 || videoFile);

  const handleSubmit = async () => {
    if (!user || !canSubmit) {
      return;
    }

    if (videoFile && imageFiles.length > 0) {
      alert('Images and videos cannot be uploaded together.');
      return;
    }

    try {
      setSubmitting(true);

      let createdPost: PostRecord;
      if (hasFiles) {
        const formData = new FormData();
        if (content.trim()) {
          formData.append('content', content.trim());
        }

        imageFiles.forEach((file) => formData.append('mediaFiles', file));

        if (videoFile) {
          formData.append('mediaFiles', videoFile);
          if (selectedThumbnail) {
            formData.append('thumbnailFile', selectedThumbnail.file);
          }
        }

        createdPost = await createMultipartPost(formData);
      } else {
        createdPost = await createJsonPost({
          content: content.trim(),
        });
      }

      onCreated?.(createdPost);
      resetComposer();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create post.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black text-sm font-black text-white">
          {user ? getInitials(user.nickname, 'JD') : 'JD'}
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={user ? "What's on your mind?" : 'Log in to create a post.'}
            className="min-h-[96px] w-full resize-none rounded-[18px] border border-zinc-200 px-4 py-3 text-[17px] font-medium text-black outline-none transition focus:border-zinc-400 placeholder:text-zinc-500"
          />

          {videoPreviewUrl ? (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-[18px] border border-zinc-200 bg-black">
                <video
                  controls
                  src={videoPreviewUrl}
                  poster={selectedThumbnail?.previewUrl ?? undefined}
                  className="aspect-video w-full bg-black object-contain"
                />
              </div>

              <div className="rounded-[18px] border border-zinc-200 bg-white p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[18px] font-black text-black">썸네일 선택 (선택사항)</p>
                    <p className="text-sm font-medium text-zinc-500">
                      선택하지 않으면 자동으로 생성된 첫 번째 썸네일이 사용됩니다.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedThumbnailId(null)}
                    className={`h-10 rounded-full border px-4 text-sm font-bold transition ${
                      selectedThumbnailId === null
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
                    }`}
                  >
                    No thumbnail
                  </button>

                  <button
                    type="button"
                    onClick={() => thumbnailInputRef.current?.click()}
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100"
                  >
                    <Upload size={16} />
                    직접 업로드
                  </button>
                </div>

                <input
                  ref={thumbnailInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleThumbnailUpload}
                />

                {generatingThumbnails ? (
                  <div className="rounded-2xl bg-zinc-50 px-4 py-6 text-sm font-bold text-zinc-500">
                    Preparing thumbnail options...
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
                          className={`shrink-0 overflow-hidden rounded-[16px] border text-left transition ${
                            isSelected ? 'border-zinc-900 shadow-sm' : 'border-zinc-200 hover:border-zinc-300'
                          }`}
                        >
                          <div className="h-20 w-32 bg-zinc-100">
                            <img src={option.previewUrl} alt={option.label} className="h-full w-full object-cover" />
                          </div>
                          <div className="flex items-center justify-between px-3 py-2">
                            <span className="text-sm font-bold text-zinc-800">{option.label}</span>
                            {option.kind === 'uploaded' ? (
                              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-black text-zinc-500">
                                Custom
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

          {imagePreviewUrls.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {imagePreviewUrls.map((url, index) => (
                <div key={url} className="overflow-hidden rounded-[18px] border border-zinc-200 bg-zinc-50">
                  <img src={url} alt={`Selected image ${index + 1}`} className="h-44 w-full object-cover" />
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-zinc-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-5 text-zinc-500">
              <input
                ref={imageInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleVideoSelect}
              />

              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="inline-flex items-center gap-2 text-[17px] font-medium transition hover:text-black"
              >
                <ImagePlus size={18} />
                Photo
              </button>

              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="inline-flex items-center gap-2 text-[17px] font-medium transition hover:text-black"
              >
                <Video size={18} />
                Video
              </button>

              <div className="inline-flex items-center gap-2 text-[17px] font-medium text-zinc-400">
                <Smile size={18} />
                Feeling
              </div>

              {hasFiles ? (
                <button
                  type="button"
                  onClick={() => {
                    clearImageSelection();
                    clearVideoSelection();
                  }}
                  className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 transition hover:text-black"
                >
                  <X size={16} />
                  Clear attachments
                </button>
              ) : null}
            </div>

            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className={`inline-flex h-11 items-center justify-center rounded-2xl px-7 text-lg font-medium text-white transition ${
                canSubmit ? 'bg-black hover:bg-zinc-800' : 'cursor-not-allowed bg-zinc-300'
              }`}
            >
              {submitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
