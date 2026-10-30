import type { Metadata } from 'next';
import { MyReports } from './_components/MyReports';

export const metadata: Metadata = {
  title: '내 신고 | GamerIN',
  description: '내가 접수한 신고와 처리 상태를 확인합니다.',
};

export default function MyReportsPage() {
  return <MyReports />;
}
