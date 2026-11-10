'use client';

import { NotificationPanel } from '@/app/home/components/NotificationPanel';
import { useSetUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount';

// 모바일 하단 탭의 알림 페이지. 데스크톱은 사이드바 슬라이드 패널을 쓰지만, 주소로 직접 들어와도 같은 목록을 보여 준다.
export default function NotificationsPage() {
  const setUnreadCount = useSetUnreadNotificationCount();

  return (
    <div className="mx-auto w-full max-w-[600px] lg:py-6">
      <NotificationPanel variant="page" onUnreadCountChange={setUnreadCount} />
    </div>
  );
}
