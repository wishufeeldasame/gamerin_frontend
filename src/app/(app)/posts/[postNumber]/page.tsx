'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { PostDetail, PostDetailHeader } from '@/app/home/components/PostDetail';
import { canGoBack } from '@/lib/history-back';
import { RightSidebar } from '@/app/home/components/RightSidebar';

export default function PostPermalinkPage() {
  const params = useParams<{ postNumber: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const postNumber = /^[1-9]\d*$/.test(params.postNumber) ? Number(params.postNumber) : null;
  const initialScrollTarget = searchParams.get('target') === 'comments' ? 'comments' : undefined;
  const initialCommentId = searchParams.get('commentId')?.trim() || undefined;

  const goBack = () => {
    // 공유 링크로 바로 열었으면 돌아갈 기록이 없다(웹앱 독립 실행에는 브라우저 뒤로가기도 없다).
    if (canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-8 md:px-8">
      <main className="min-h-screen min-w-0 flex-1">
        <div className="lg:py-6">
          {postNumber === null ? (
            <>
              <PostDetailHeader onBack={goBack} />
              <p role="alert" className="p-6 text-center text-body text-fg-tertiary">게시글을 찾을 수 없습니다.</p>
            </>
          ) : (
          <PostDetail
            postNumber={postNumber}
            onBack={goBack}
            initialScrollTarget={initialScrollTarget}
            initialCommentId={initialCommentId}
            onPostDeleted={() => router.push('/')}
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
