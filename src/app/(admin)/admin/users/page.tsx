import type { Metadata } from 'next';
import { AdminShell } from '../_components/AdminShell';
import { adminFont } from '../_components/admin-font';
import { AdminUsersTable } from './_components/AdminUsersTable';

export const metadata: Metadata = {
  title: '사용자 관리 | GamerIN 관리자',
  description: 'GamerIN 관리자 사용자 관리',
};

export default function AdminUsersPage() {
  return (
    <main className={adminFont.className}>
      <AdminShell
        activePage="users"
        title="사용자 관리"
        description="사용자 검색과 계정 상태 및 제재 관리"
        breadcrumbs={[{ label: '관리자', href: '/admin' }, { label: '사용자 관리' }]}
      >
        <AdminUsersTable />
      </AdminShell>
    </main>
  );
}
