import type { Metadata } from 'next';
import { AdminShell } from '../_components/AdminShell';
import { adminFont } from '../_components/admin-font';
import { AdminReportsManagement } from './_components/AdminReportsManagement';

export const metadata: Metadata = {
  title: '신고 관리 | GamerIN 관리자',
  description: 'GamerIN 신고 관리',
};

export default function AdminReportsPage() {
  return (
    <main className={adminFont.className}>
      <AdminShell
        activePage="reports"
        title="신고 관리"
        description="접수된 신고를 확인하고 처리하세요."
        showRefresh={false}
        breadcrumbs={[{ label: '관리자', href: '/admin' }, { label: '신고 관리' }]}
      >
        <AdminReportsManagement />
      </AdminShell>
    </main>
  );
}
