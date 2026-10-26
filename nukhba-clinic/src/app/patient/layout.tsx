import { requireRole } from '@/lib/session';
import { AppShell } from '@/components/app-shell';

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(['patient']);
  return <AppShell profile={profile}>{children}</AppShell>;
}
