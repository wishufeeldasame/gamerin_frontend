import { redirect } from 'next/navigation';

export default async function LegacyResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params?.token?.trim();
  redirect(
    token
      ? `/auth/reset-password?token=${encodeURIComponent(token)}`
      : '/auth/reset-password'
  );
}
