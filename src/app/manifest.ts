import type { MetadataRoute } from 'next';

// 설치형 웹앱(데스크톱 Chrome·Edge, iOS 홈 화면) 선언. scope를 '/'로 둬서 앱 안 이동이 범위 밖으로 처리되지 않게 한다(README 10-2).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GamerIN',
    short_name: 'GamerIN',
    description: '실력 인증부터 멘토링까지, 게이머들의 이력서이자 커뮤니티',
    lang: 'ko',
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    // 다크가 기본이라 실행 직후 흰 화면이 번쩍이지 않게 다크 바탕을 쓴다(10-3).
    background_color: '#0C0C0E',
    theme_color: '#0C0C0E',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
