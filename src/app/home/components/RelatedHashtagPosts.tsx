'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchHashtagPosts } from '@/lib/community-search-api';
import { type PostRecord, getPostHref } from '@/lib/feed-api';
import { RelativeTime } from './RelativeTime';

const RELATED_POST_COUNT = 4;
const HASHTAG_PATTERN = /#([\p{L}\p{N}_]{1,50})/u;

export function firstHashtag(content: string | null | undefined) {
  return content?.match(HASHTAG_PATTERN)?.[1] ?? null;
}

// 게시물의 첫 해시태그로 같은 태그 글을 몇 개 보여 준다. 실패하거나 결과가 없으면 아무것도 그리지 않는다.
export function RelatedHashtagPosts({ content, excludePostId }: { content: string | null; excludePostId: string }) {
  const hashtag = firstHashtag(content);
  const [posts, setPosts] = useState<PostRecord[]>([]);

  useEffect(() => {
    if (!hashtag) return;
    const controller = new AbortController();
    fetchHashtagPosts(hashtag, null, RELATED_POST_COUNT + 1, { signal: controller.signal })
      .then((page) => setPosts(page.items.filter((item) => item.postId !== excludePostId).slice(0, RELATED_POST_COUNT)))
      .catch(() => setPosts([]));
    return () => controller.abort();
  }, [excludePostId, hashtag]);

  if (!hashtag || posts.length === 0) return null;

  return (
    <section aria-labelledby="related-posts-title" className="mt-6 px-4 md:px-0">
      <h2 id="related-posts-title" className="section-title mb-3">
        #{hashtag} 관련 게시글
      </h2>
      <ul className="grid gap-2 md:grid-cols-2">
        {posts.map((item) => (
          <li key={item.postId}>
            <Link
              href={getPostHref(item.postNumber)}
              className="block h-full rounded-card border border-line-card bg-surface p-4 transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg-brand dark:focus-visible:outline-line-focus"
            >
              <p className="text-caption text-fg-tertiary">
                {item.author} · <RelativeTime createdAt={item.createdAt} />
              </p>
              <p className="mt-1 line-clamp-2 text-body text-fg-primary">{item.content || '미디어 게시글'}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
