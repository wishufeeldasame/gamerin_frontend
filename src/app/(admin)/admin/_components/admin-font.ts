import localFont from 'next/font/local';

export const adminFont = localFont({
  src: '../_fonts/NotoSansKR-VF.woff2',
  weight: '100 900',
  display: 'swap',
  // 한글 전체를 담은 단일 파일(약 3.9MB)이라 preload하면 첫 화면 리소스와 대역폭을 다툰다.
  preload: false,
});
