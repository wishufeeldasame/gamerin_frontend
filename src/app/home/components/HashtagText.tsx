'use client';

import Link from 'next/link';
import { parseMentions } from '@/lib/mention-parser';
import { MentionLink } from './MentionLink';

const HASHTAG_PATTERN = /#[\p{L}\p{N}_]{1,50}/gu;

interface HashtagTextProps {
  text: string;
  className?: string;
  linkHashtags?: boolean;
}

export function HashtagText({ text, className, linkHashtags = true }: HashtagTextProps) {
  const parts: Array<{ value: string; hashtag?: string; mention?: string }> = [];
  const matches: Array<{ start: number; end: number; mention?: string; hashtag?: string }> =
    parseMentions(text).map(({ start, end, handle }) => ({ start, end, mention: handle }));
  if (linkHashtags) {
    for (const match of text.matchAll(HASHTAG_PATTERN)) {
      matches.push({ start: match.index, end: match.index + match[0].length, hashtag: match[0].slice(1) });
    }
  }
  matches.sort((left, right) => left.start - right.start);
  let lastIndex = 0;

  for (const match of matches) {
    if (match.start < lastIndex) continue;
    if (match.start > lastIndex) {
      parts.push({ value: text.slice(lastIndex, match.start) });
    }
    parts.push({ value: text.slice(match.start, match.end), hashtag: match.hashtag, mention: match.mention });
    lastIndex = match.end;
  }

  if (lastIndex < text.length) {
    parts.push({ value: text.slice(lastIndex) });
  }

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.mention ? (
          <MentionLink key={`${part.value}-${index}`} value={part.value} handle={part.mention} />
        ) : part.hashtag ? (
          <Link
            key={`${part.value}-${index}`}
            href={`/hashtags/${encodeURIComponent(part.hashtag)}`}
            className="font-black text-emerald-700 transition hover:text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 dark:focus-visible:outline-emerald-400"
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
