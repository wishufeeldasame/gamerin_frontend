'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { ImagePlus, Link2, Video, X } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { PostRecord, createJsonPost, createMultipartPost, getInitials } from '@/lib/feed-api';

interface PostComposerProps {
  onCreated?: (post: PostRecord) => void;
}

export function PostComposer({ onCreated }: PostComposerProps) {
  const { user } = useAuth();
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const [content, setContent] = useState('');
  const [externalLinkUrl, setExternalLinkUrl] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const hasFiles = imageFiles.length > 0 || Boolean(videoFile);

  const resetComposer = () => {
    setContent('');
    setExternalLinkUrl('');
    setImageFiles([]);
    setVideoFile(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleImageSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setVideoFile(null);
    setImageFiles(files.slice(0, 4));
  };

  const handleVideoSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setImageFiles([]);
    setVideoFile(selected);
  };

  const canSubmit =
    Boolean(user) &&
    !submitting &&
    Boolean(content.trim() || externalLinkUrl.trim() || imageFiles.length > 0 || videoFile);

  const handleSubmit = async () => {
    if (!user || !canSubmit) {
      return;
    }

    if (hasFiles && externalLinkUrl.trim()) {
      alert('Media upload and external link card cannot be used together.');
      return;
    }

    try {
      setSubmitting(true);

      let createdPost: PostRecord;
      if (hasFiles) {
        const formData = new FormData();
        if (content.trim()) formData.append('content', content.trim());

        imageFiles.forEach((file) => formData.append('mediaFiles', file));
        if (videoFile) {
          formData.append('mediaFiles', videoFile);
        }

        createdPost = await createMultipartPost(formData);
      } else {
        createdPost = await createJsonPost({
          content: content.trim(),
          externalLinkUrl: externalLinkUrl.trim(),
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
    <section className="overflow-hidden rounded-[32px] border border-zinc-100 bg-white p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black text-sm font-black text-white shadow-inner">
          {user ? getInitials(user.nickname) : 'G'}
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={user ? `${user.nickname}, what game moment do you want to share?` : 'Log in to create a post.'}
            className="min-h-[110px] w-full resize-none border-none bg-transparent text-[16px] font-medium text-black outline-none placeholder:text-zinc-400"
          />

          <div>
            <input
              value={externalLinkUrl}
              onChange={(event) => setExternalLinkUrl(event.target.value)}
              placeholder="External link URL"
              className="w-full rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm font-medium text-black outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {imageFiles.map((file) => (
              <span key={file.name} className="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-black text-zinc-600">
                {file.name}
              </span>
            ))}
            {videoFile ? (
              <span className="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-black text-zinc-600">{videoFile.name}</span>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-zinc-50 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
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
                title="Add images"
                onClick={() => imageInputRef.current?.click()}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-500 transition-all hover:bg-black hover:text-white"
              >
                <ImagePlus size={20} />
              </button>

              <button
                type="button"
                title="Add video"
                onClick={() => videoInputRef.current?.click()}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-500 transition-all hover:bg-black hover:text-white"
              >
                <Video size={20} />
              </button>

              <button
                type="button"
                title="Clear attachments"
                onClick={() => {
                  setImageFiles([]);
                  setVideoFile(null);
                  setExternalLinkUrl('');
                  if (imageInputRef.current) imageInputRef.current.value = '';
                  if (videoInputRef.current) videoInputRef.current.value = '';
                }}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-500 transition-all hover:bg-black hover:text-white"
              >
                <X size={20} />
              </button>

              <div className="ml-2 hidden items-center gap-2 rounded-2xl bg-zinc-50 px-3 py-2 text-xs font-black text-zinc-500 md:flex">
                <Link2 size={14} />
                {externalLinkUrl.trim() ? 'Link card mode' : 'No link'}
              </div>
            </div>

            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className={`rounded-2xl px-8 py-3 text-sm font-black text-white transition-all shadow-lg shadow-zinc-200 ${
                canSubmit ? 'bg-black hover:scale-[1.02] active:scale-[0.98]' : 'cursor-not-allowed bg-zinc-200 shadow-none'
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
