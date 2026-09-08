import type { Metadata } from 'next';
import { AdminShell } from '../_components/AdminShell';
import { adminFont } from '../_components/admin-font';
import { AdminContentManagement } from './_components/AdminContentManagement';

export const metadata: Metadata = {
  title: '숨김 콘텐츠 관리 | GamerIN 관리자',
  description: 'GamerIN 자동 숨김 콘텐츠 관리',
};

export default function AdminContentPage() {
  return (
    <main className={adminFont.className}>
      <AdminShell
        activePage="content"
        title="숨김 콘텐츠 관리"
        description="자동 숨김 처리된 콘텐츠를 확인하고 지원되는 유형을 복구합니다."
        showRefresh={false}
        breadcrumbs={[{ label: '관리자', href: '/admin' }, { label: '숨김 콘텐츠 관리' }]}
      >
        <AdminContentManagement />
      </AdminShell>
    </main>
  );
}
