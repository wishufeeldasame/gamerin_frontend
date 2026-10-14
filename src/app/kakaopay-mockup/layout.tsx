import { Noto_Sans_KR } from 'next/font/google';

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  display: 'swap',
});

export default function KakaoPayMockupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className={notoSansKr.className}>{children}</div>;
}
