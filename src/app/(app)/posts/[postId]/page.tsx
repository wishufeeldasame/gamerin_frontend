'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { PostDetail } from '@/app/home/components/PostDetail';
import { RightSidebar } from '@/app/home/components/RightSidebar';

export default function PostPermalinkPage() {
  const params = useParams<{ postId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const postId = params.postId;
  const initialScrollTarget = searchParams.get('target') === 'comments' ? 'comments' : undefined;
  const initialCommentId = searchParams.get('commentId')?.trim() || undefined;

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-8 md:px-8">
      <main className="min-h-screen min-w-0 flex-1">
        <div className="md:py-6">
          <PostDetail
            postId={postId}
            onBack={() => router.back()}
            initialScrollTarget={initialScrollTarget}
            initialCommentId={initialCommentId}
            onPostDeleted={() => router.push('/home')}
          />
        </div>
      </main>

      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-80 shrink-0 py-6 xl:block">
        <RightSidebar />
      </aside>
    </div>
  );
}
