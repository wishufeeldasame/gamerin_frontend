import type { Metadata } from 'next';
import { AdminShell } from '../_components/AdminShell';
import { adminFont } from '../_components/admin-font';
import { AdminMentoringManagement } from './_components/AdminMentoringManagement';

export const metadata: Metadata = {
  title: '멘토링 관리 | GamerIN 관리자',
  description: 'GamerIN 관리자 멘토링 관리',
};

export default function AdminMentoringPage() {
  return (
    <main className={adminFont.className}>
      <AdminShell
        activePage="mentoring"
        title="멘토링 관리"
        description="멘토 신청 승인과 멘토링 프로그램 운영 상태를 관리합니다."
        breadcrumbs={[{ label: '관리자', href: '/admin' }, { label: '멘토링 관리' }]}
      >
        <AdminMentoringManagement />
      </AdminShell>
    </main>
  );
}
