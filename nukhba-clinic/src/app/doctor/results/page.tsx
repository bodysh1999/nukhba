import Link from 'next/link';
import { FlaskConical } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { Card, EmptyState, PageHeader, Badge } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import { ResultForm } from '../encounter-client';
import { getMyDoctor } from '../data';

export const metadata = { title: 'النتائج' };
type Row = { id: string; test_name: string; kind: 'lab' | 'radiology'; created_at: string; visit_id: string; patient_id: string; patients: { full_name: string; file_no: string } | null; visits: { doctor_id: string } | null };

export default async function PendingResults() {
  const [{ d, locale }, supabase, me] = await Promise.all([getI18n(), createClient(), getMyDoctor()]);
  if (!me) return <EmptyState title={d.errors.FORBIDDEN} />;
  const { data } = await supabase.from('lab_orders').select('id, test_name, kind, created_at, visit_id, patient_id, patients(full_name, file_no), visits!inner(doctor_id)')
    .eq('status', 'ordered').eq('visits.doctor_id', me.id).order('created_at').limit(100);
  const rows = (data ?? []) as unknown as Row[];
  return (
    <div>
      <PageHeader title={d.cl.dr.pendingResults} subtitle={`${rows.length}`} />
      {rows.length === 0 ? <Card><EmptyState icon={<FlaskConical className="h-5 w-5" />} title={d.common.noData} /></Card> : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.test_name}</span>
                <Badge className="bg-sand-100 text-ink/70 ring-sand-200">{d.cl.testKind[r.kind]}</Badge>
                <span className="text-sm text-stone-450">· <Link href={`/doctor/patients/${r.patient_id}`} className="hover:text-brand">{r.patients?.full_name}</Link> <span dir="ltr">({r.patients?.file_no})</span></span>
                <span className="ms-auto text-xs text-stone-450">{fmtDate(r.created_at, locale)}</span>
              </div>
              <ResultForm orderId={r.id} patientId={r.patient_id} visitId={r.visit_id} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
