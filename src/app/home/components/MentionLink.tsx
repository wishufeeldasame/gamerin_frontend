'use client';

import Link from 'next/link';

const MENTION_STYLE = 'font-black text-sky-700 transition hover:text-sky-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 dark:text-sky-400 dark:hover:text-sky-300 dark:focus-visible:outline-sky-400';

export function MentionLink({ value, handle }: { value: string; handle: string }) {
  return (
    <Link
      href={`/profile/${encodeURIComponent(handle)}`}
      className={MENTION_STYLE}
      data-card-open-ignore="true"
    >
      {value}
    </Link>
  );
}
