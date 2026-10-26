import { getI18n } from '@/lib/session';
import { getInsurers } from '@/lib/clinic-data';
import { Card, PageHeader } from '@/components/ui';
import { PatientForm } from '../../desk-client';

export default async function NewPatient({ searchParams }: { searchParams: Promise<{ then?: string }> }) {
  const sp = await searchParams;
  const [{ d }, insurers] = await Promise.all([getI18n(), getInsurers()]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={d.cl.desk.newFile} />
      <Card className="p-5 sm:p-6"><PatientForm insurers={insurers} then={sp.then === 'book' ? 'book' : undefined} /></Card>
    </div>
  );
}
