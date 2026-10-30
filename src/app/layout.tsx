import type { Metadata, Viewport } from "next";
import "./globals.css";
// 1. 전역 인증 상태 관리를 위해 AuthProvider를 가져옵니다.
import { AuthProvider } from '@/app/context/AuthContext';
import { BookmarkCollectionProvider } from '@/app/context/BookmarkCollectionContext';
import { FeedbackProviders } from '@/app/context/FeedbackProviders';

// 2. 서비스에 맞는 메타데이터 설정 (가독성과 검색 최적화)
export const metadata: Metadata = {
  title: "GamerIN | 게이머를 위한 소셜 네트워킹",
  description: "실력 인증부터 멘토링까지, 게이머들의 이력서이자 커뮤니티",
};

// 아이폰 홈 인디케이터 영역을 env(safe-area-inset-bottom)으로 받기 위해 cover로 둔다.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const settings = JSON.parse(localStorage.getItem('gamerin_user_settings') || '{}');
                if (settings.theme === 'dark') {
                  document.documentElement.classList.add('dark');
                }
              } catch {}
            `,
          }}
        />
      </head>
      <body className="antialiased">
        {/* 3. AuthProvider로 전체를 감싸서 로그인 상태를 전역으로 관리합니다. */}
        <AuthProvider>
          <BookmarkCollectionProvider>
            <FeedbackProviders>{children}</FeedbackProviders>
          </BookmarkCollectionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
