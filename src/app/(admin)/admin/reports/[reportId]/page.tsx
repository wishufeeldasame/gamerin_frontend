import type { Metadata } from 'next';
import { AdminShell } from '../../_components/AdminShell';
import Link from 'next/link';
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
        description="현재 백엔드가 제공하는 신고 관리 기능 범위에서 상태를 확인합니다."
        breadcrumbs={[
          { label: '관리자', href: '/admin' },
          { label: '신고 관리', href: '/admin/reports' },
          { label: reportId },
        ]}
        showRefresh={false}
      >
        <section className="mx-auto w-full max-w-[760px] p-4 sm:p-6 lg:p-8">
          <div className="rounded-[20px] border border-[#e4e7ec] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <h2 className="text-lg font-bold text-[#172033]">신고 상세 API 연결 대기</h2>
            <p className="mt-2 text-sm leading-6 text-[#667085]">
              현재 백엔드는 신고 목록 조회와 상태 변경만 제공합니다. 개별 신고 상세 조회와
              제재 처리는 API가 추가된 뒤 이 화면에 연결할 예정입니다.
            </p>
            <p className="mt-3 font-mono text-xs text-[#98a2b3]">신고 코드: {reportId}</p>
            <Link
              href="/admin/reports"
              className="mt-5 inline-flex h-10 items-center rounded-2xl bg-[#315ef5] px-4 text-sm font-semibold text-white hover:bg-[#294fd5]"
            >
              신고 목록으로 돌아가기
            </Link>
          </div>
        </section>
      </AdminShell>
    </main>
  );
}
