'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/app/components/AppShell';
import { PostDetail } from '@/app/home/components/PostDetail';
import { RightSidebar } from '@/app/home/components/RightSidebar';

export default function PostPermalinkPage() {
  const params = useParams<{ postId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const postId = params.postId;
  const initialScrollTarget = searchParams.get('target') === 'comments' ? 'comments' : undefined;

  return (
    <AppShell>
      <div className="flex justify-center overflow-visible">
        <main className="min-h-screen max-w-2xl flex-1 border-x border-zinc-50">
          <div className="p-4">
            <PostDetail
              postId={postId}
              onBack={() => router.back()}
              initialScrollTarget={initialScrollTarget}
              onPostDeleted={() => router.push('/home')}
            />
          </div>
        </main>

        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-80 p-6 xl:block">
          <RightSidebar />
        </aside>
      </div>
    </AppShell>
  );
}
