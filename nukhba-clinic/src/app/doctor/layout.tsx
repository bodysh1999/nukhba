import { requireRole } from '@/lib/session';
import { AppShell } from '@/components/app-shell';

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(['doctor']);
  return <AppShell profile={profile}>{children}</AppShell>;
}
