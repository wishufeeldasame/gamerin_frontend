'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { PostDetail } from '@/app/home/components/PostDetail';
import { RightSidebar } from '@/app/home/components/RightSidebar';

export default function PostPermalinkPage() {
  const params = useParams<{ postNumber: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const postNumber = /^[1-9]\d*$/.test(params.postNumber) ? Number(params.postNumber) : null;
  const initialScrollTarget = searchParams.get('target') === 'comments' ? 'comments' : undefined;
  const initialCommentId = searchParams.get('commentId')?.trim() || undefined;

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-8 md:px-8">
      <main className="min-h-screen min-w-0 flex-1">
        <div className="md:py-6">
          {postNumber === null ? (
            <p role="alert" className="p-6 text-center text-sm text-zinc-500">게시글을 찾을 수 없습니다.</p>
          ) : (
          <PostDetail
            postNumber={postNumber}
            onBack={() => router.back()}
            initialScrollTarget={initialScrollTarget}
            initialCommentId={initialCommentId}
            onPostDeleted={() => router.push('/home')}
          />
          )}
        </div>
      </main>

      <aside className="sticky top-[var(--app-header-height)] hidden h-[calc(100vh-var(--app-header-height))] w-80 shrink-0 py-6 xl:block">
        <RightSidebar />
      </aside>
    </div>
  );
}
