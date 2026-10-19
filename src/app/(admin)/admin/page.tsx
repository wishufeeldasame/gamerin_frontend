import type { Metadata } from 'next';
import { AdminDashboard } from './_components/AdminDashboard';
import { adminFont } from './_components/admin-font';

export const metadata: Metadata = {
  title: '관리자 대시보드 | GamerIN',
  description: 'GamerIN 관리자 시스템 주요 현황',
};

export default function AdminDashboardPage() {
  return (
    <main className={adminFont.className}>
      <AdminDashboard />
    </main>
  );
}
