import type { ReactNode } from 'react';
import { AdminRouteGuard } from './_components/AdminRouteGuard';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminRouteGuard>{children}</AdminRouteGuard>;
}
