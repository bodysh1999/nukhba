import { requireRole } from '@/lib/session';
import { AppShell } from '@/components/app-shell';

export default async function ReceptionLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(['admin', 'reception']);
  return <AppShell profile={profile}>{children}</AppShell>;
}
