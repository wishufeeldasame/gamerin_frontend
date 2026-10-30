import type { Metadata } from 'next';
import { AdminShell } from '../../_components/AdminShell';
import { AdminReportDetail } from '../_components/AdminReportDetail';
import { adminFont } from '../../_components/admin-font';

type AdminReportDetailPageProps = {
  params: Promise<{ reportId: string }>;
};

export async function generateMetadata({ params }: AdminReportDetailPageProps): Promise<Metadata> {
  const { reportId } = await params;
  return {
    title: `${reportId} 신고 상세 | GamerIN 관리자`,
    description: `${reportId} 신고 상세 정보`,
  };
}

export default async function AdminReportDetailPage({ params }: AdminReportDetailPageProps) {
  const { reportId } = await params;

  return (
    <main className={adminFont.className}>
      <AdminShell
        activePage="reports"
        title="신고 상세"
        description="신고 내용을 검토하고 콘텐츠 조치와 사용자 제재를 처리합니다."
        breadcrumbs={[
          { label: '관리자', href: '/admin' },
          { label: '신고 관리', href: '/admin/reports' },
          { label: reportId },
        ]}
        showRefresh={false}
      >
        <AdminReportDetail reportCode={reportId} />
      </AdminShell>
    </main>
  );
}
