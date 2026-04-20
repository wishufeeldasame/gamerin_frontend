import { redirect } from 'next/navigation';

export default function LegacyFindPasswordPage() {
  redirect('/auth/forgot-password');
}
