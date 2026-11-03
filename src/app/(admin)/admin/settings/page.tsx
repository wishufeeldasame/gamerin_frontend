import type { Metadata } from 'next';
import { adminFont } from '../_components/admin-font';
import { AdminSettingsScreen } from './_components/AdminSettingsScreen';

export const metadata: Metadata = {
  title: '시스템 설정 | GamerIN 관리자',
  description: 'GamerIN 관리자 시스템 설정',
};

export default function AdminSettingsPage() {
  return (
    <main className={adminFont.className}>
      <AdminSettingsScreen />
    </main>
  );
}
