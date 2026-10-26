import { requireRole } from '@/lib/session';
import { AppShell } from '@/components/app-shell';

export default async function BillingLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(['admin', 'reception', 'accountant']);
  return <AppShell profile={profile}>{children}</AppShell>;
}
