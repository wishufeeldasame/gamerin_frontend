'use client';

import Link from 'next/link';

const HASHTAG_PATTERN = /#[\p{L}\p{N}_]{1,50}/gu;

interface HashtagTextProps {
  text: string;
  className?: string;
}

export function HashtagText({ text, className }: HashtagTextProps) {
  const parts: Array<{ value: string; hashtag?: string }> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(HASHTAG_PATTERN)) {
    const value = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      parts.push({ value: text.slice(lastIndex, index) });
    }

    parts.push({ value, hashtag: value.slice(1) });
    lastIndex = index + value.length;
  }

  if (lastIndex < text.length) {
    parts.push({ value: text.slice(lastIndex) });
  }

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.hashtag ? (
          <Link
            key={`${part.value}-${index}`}
            href={`/hashtags/${encodeURIComponent(part.hashtag)}`}
            className="font-black text-emerald-600 transition hover:text-emerald-700 hover:underline"
            data-card-open-ignore="true"
          >
            {part.value}
          </Link>
        ) : (
          <span key={`${part.value}-${index}`}>{part.value}</span>
        ),
      )}
    </span>
  );
}
