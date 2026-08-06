import type { Metadata } from 'next';
import { AdminShell } from '../_components/AdminShell';
import { adminFont } from '../_components/admin-font';
import { AdminAuditLogs } from './_components/AdminAuditLogs';

export const metadata: Metadata = {
  title: '작업 이력 | GamerIN 관리자',
  description: 'GamerIN 관리자 작업 이력',
};

export default function AdminAuditLogsPage() {
  return (
    <main className={adminFont.className}>
      <AdminShell
        activePage="auditLogs"
        title="작업 이력"
        description="관리자 처리 내역을 읽기 전용으로 확인합니다."
        breadcrumbs={[{ label: '관리자', href: '/admin' }, { label: '작업 이력' }]}
      >
        <AdminAuditLogs />
      </AdminShell>
    </main>
  );
}
