'use client';

import { useRouter } from 'next/navigation';
import { NotificationPanel } from '@/app/home/components/NotificationPanel';
import { useSetUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount';
import { canGoBack } from '@/lib/history-back';

// 모바일 알림 페이지(F9). 데스크톱은 사이드바 슬라이드 패널을 쓰지만, 주소로 직접 들어와도 같은 목록을 보여 준다.
export default function NotificationsPage() {
  const router = useRouter();
  const setUnreadCount = useSetUnreadNotificationCount();

  const goBack = () => {
    // 웹앱 독립 실행에는 브라우저 뒤로가기가 없고, 주소로 바로 열었으면 돌아갈 기록이 없다(10-3).
    if (canGoBack()) router.back();
    else router.replace('/home');
  };

  return (
    <div className="mx-auto w-full max-w-[600px] lg:py-6">
      <NotificationPanel variant="page" onClose={goBack} onUnreadCountChange={setUnreadCount} />
    </div>
  );
}
