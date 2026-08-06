import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdminShell } from '../../_components/AdminShell';
import { adminFont } from '../../_components/admin-font';
import { AdminReportDetail } from '../_components/AdminReportDetail';
import { getReportById } from '../_data/reports';

type AdminReportDetailPageProps = {
  params: Promise<{ reportId: string }>;
};

export async function generateMetadata({ params }: AdminReportDetailPageProps): Promise<Metadata> {
  const { reportId } = await params;
  const report = getReportById(reportId);

  return {
    title: report ? `${report.id} 신고 상세 | GamerIN 관리자` : '신고를 찾을 수 없음',
    description: report ? `${report.id} 신고 상세 정보` : undefined,
  };
}

export default async function AdminReportDetailPage({ params }: AdminReportDetailPageProps) {
  const { reportId } = await params;
  const report = getReportById(reportId);

  if (!report) {
    notFound();
  }

  return (
    <main className={adminFont.className}>
      <AdminShell
        activePage="reports"
        title="신고 상세"
        description="신고 증거를 확인한 뒤 콘텐츠 조치와 사용자 제재를 결정하세요."
        breadcrumbs={[
          { label: '관리자', href: '/admin' },
          { label: '신고 관리', href: '/admin/reports' },
          { label: report.id },
        ]}
        showRefresh={false}
      >
        <AdminReportDetail report={report} />
      </AdminShell>
    </main>
  );
}
