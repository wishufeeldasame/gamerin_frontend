import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// 1. 전역 인증 상태 관리를 위해 AuthProvider를 가져옵니다.
import { AuthProvider } from '@/app/context/AuthContext';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 2. 서비스에 맞는 메타데이터 설정 (가독성과 검색 최적화)
export const metadata: Metadata = {
  title: "GamerIN | 게이머를 위한 소셜 네트워킹",
  description: "실력 인증부터 멘토링까지, 게이머들의 이력서이자 커뮤니티",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko"> {/* 한국어 서비스이므로 ko로 변경 */}
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* 3. AuthProvider로 전체를 감싸서 로그인 상태를 전역으로 관리합니다. */}
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}