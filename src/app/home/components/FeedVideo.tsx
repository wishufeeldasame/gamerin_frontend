'use client';

import type { PostMedia } from '@/lib/feed-api';
import { useFeedVideoPlayback } from '@/hooks/useFeedVideoPlayback';

export function FeedVideo({ media, className }: { media: PostMedia; className: string }) {
  const ref = useFeedVideoPlayback();
  return (
    <video
      ref={ref}
      controls
      muted
      playsInline
      preload="metadata"
      poster={media.thumbnailUrl ?? undefined}
      className={className}
      src={media.mediaUrl}
    />
  );
}
