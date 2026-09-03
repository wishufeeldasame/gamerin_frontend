import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdminShell } from '../../_components/AdminShell';
import { adminFont } from '../../_components/admin-font';
import { AdminUserDetail } from '../_components/AdminUserDetail';
import { findAdminUser } from '../_data/admin-users';

export const metadata: Metadata = {
  title: '사용자 상세 | GamerIN 관리자',
  description: 'GamerIN 관리자 사용자 상세',
};

type AdminUserDetailPageProps = {
  params: Promise<{ handle: string }>;
};

export default async function AdminUserDetailPage({ params }: AdminUserDetailPageProps) {
  const { handle } = await params;
  const user = findAdminUser(handle);

  if (!user) {
    notFound();
  }

  return (
    <main className={adminFont.className}>
      <AdminShell
        activePage="users"
        title="사용자 상세"
        breadcrumbs={[
          { label: '관리자', href: '/admin' },
          { label: '사용자 관리', href: '/admin/users' },
          { label: `@${user.handle}` },
        ]}
        showRefresh={false}
      >
        <AdminUserDetail user={user} />
      </AdminShell>
    </main>
  );
}
