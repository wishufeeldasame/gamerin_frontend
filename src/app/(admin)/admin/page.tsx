import type { Metadata } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import { AdminDashboard } from './_components/AdminDashboard';

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '900'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: '관리자 대시보드 | GamerIN',
  description: 'GamerIN 관리자 시스템 주요 현황',
};

export default function AdminDashboardPage() {
  return (
    <main className={notoSansKr.className}>
      <AdminDashboard />
    </main>
  );
}
