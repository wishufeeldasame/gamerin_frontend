import type { Metadata, Viewport } from "next";
import "./globals.css";
// 1. 전역 인증 상태 관리를 위해 AuthProvider를 가져옵니다.
import { AuthProvider } from '@/app/context/AuthContext';
import { BookmarkCollectionProvider } from '@/app/context/BookmarkCollectionContext';
import { LoginPromptProvider } from '@/app/auth/_components/LoginPromptProvider';
import { FeedbackProviders } from '@/app/context/FeedbackProviders';
import { APP_THEME_COLORS } from '@/lib/theme-colors';

// 2. 서비스에 맞는 메타데이터 설정 (가독성과 검색 최적화)
export const metadata: Metadata = {
  title: "GamerIN | 게이머를 위한 소셜 네트워킹",
  description: "실력 인증부터 멘토링까지, 게이머들의 이력서이자 커뮤니티",
  // iOS 홈 화면 앱(README 10-2). 매니페스트는 src/app/manifest.ts가 링크를 만든다.
  appleWebApp: {
    capable: true,
    title: "GamerIN",
    // 콘텐츠가 상태 표시줄 아래까지 올라오므로 상단 바·뒤로 헤더가 env(safe-area-inset-top)만큼 띄운다.
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  // Next 15는 appleWebApp.capable을 mobile-web-app-capable로만 출력한다. 매니페스트를 읽지 않는 구형 iOS용으로 함께 둔다.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

// 아이폰 홈 인디케이터·노치 영역을 env(safe-area-inset-*)으로 받기 위해 cover로 둔다.
// themeColor는 기본(다크) 값이다. 라이트 테마는 아래 스크립트와 applyThemeMode가 바꾼다.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: APP_THEME_COLORS.dark,
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
              let isLight = location.pathname.startsWith('/admin');
              try {
                const settings = JSON.parse(localStorage.getItem('gamerin_user_settings') || '{}');
                isLight ||= settings?.theme === 'light';
              } catch {}
              if (!isLight) {
                document.documentElement.classList.add('dark');
              } else {
                // 메타 태그가 이 스크립트 뒤에 올 수 있어 문서를 다 읽은 뒤 바꾼다.
                document.addEventListener('DOMContentLoaded', function () {
                  var meta = document.querySelector('meta[name="theme-color"]');
                  if (meta) meta.setAttribute('content', '${APP_THEME_COLORS.light}');
                });
              }
            `,
          }}
        />
      </head>
      <body className="antialiased">
        {/* 3. AuthProvider로 전체를 감싸서 로그인 상태를 전역으로 관리합니다. */}
        <AuthProvider>
          <BookmarkCollectionProvider>
            <FeedbackProviders><LoginPromptProvider>{children}</LoginPromptProvider></FeedbackProviders>
          </BookmarkCollectionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
