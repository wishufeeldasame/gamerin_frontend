import type { Metadata } from 'next';
import { adminFont } from '../_components/admin-font';
import { AdminWeeklyReports } from './_components/AdminWeeklyReports';

export const metadata: Metadata = {
  title: '주간 전적 리포트 | GamerIN 관리자',
  description: '발로란트 주간 전적 리포트 수동 생성',
};

export default function AdminWeeklyReportsPage() {
  return (
    <main className={adminFont.className}>
      <AdminWeeklyReports />
    </main>
  );
}
