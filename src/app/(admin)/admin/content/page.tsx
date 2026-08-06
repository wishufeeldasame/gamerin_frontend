import type { Metadata } from 'next';
import { AdminShell } from '../_components/AdminShell';
import { adminFont } from '../_components/admin-font';
import { AdminContentManagement } from './_components/AdminContentManagement';

export const metadata: Metadata = {
  title: '게시글·댓글 관리 | GamerIN 관리자',
  description: 'GamerIN 숨김 게시글과 댓글 관리',
};

export default function AdminContentPage() {
  return (
    <main className={adminFont.className}>
      <AdminShell
        activePage="content"
        title="게시글·댓글 관리"
        description="숨김 처리된 게시글과 댓글을 확인하고 복구합니다."
        breadcrumbs={[{ label: '관리자', href: '/admin' }, { label: '게시글·댓글 관리' }]}
      >
        <AdminContentManagement />
      </AdminShell>
    </main>
  );
}
