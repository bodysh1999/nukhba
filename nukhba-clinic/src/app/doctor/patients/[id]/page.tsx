import { notFound } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { Avatar, PatientLine } from '@/components/clinic-ui';
import { DocumentsList, loadRecord, ResultsList, VisitsTimeline } from '@/components/medical-record';
import { Card, KeyValue, PageHeader } from '@/components/ui';
import type { Patient } from '@/lib/types';
import { AlertsForm } from '../../encounter-client';

export default async function PatientChart({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ d, locale }, supabase] = await Promise.all([getI18n(), createClient()]);
  const { data: p } = await supabase.from('patients').select('*').eq('id', id).maybeSingle();
  if (!p) notFound();
  const patient = p as Patient;
  const rec = await loadRecord(id);
  const f = d.cl.f;
  return (
    <div>
      <PageHeader eyebrow={d.cl.dr.chart} title={patient.full_name} subtitle={<PatientLine p={patient} d={d} />} />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-8">
          <section><h2 className="mb-3 text-lg font-semibold">{d.cl.rec.visits}</h2><VisitsTimeline data={rec} d={d} locale={locale} audience="doctor" /></section>
          <section><h2 className="mb-3 text-lg font-semibold">{d.cl.rec.results}</h2><ResultsList data={rec} d={d} locale={locale} /></section>
          <section><h2 className="mb-3 text-lg font-semibold">{d.cl.rec.docs}</h2><DocumentsList data={rec} d={d} locale={locale} /></section>
        </div>
        <aside className="space-y-4">
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-3"><Avatar name={patient.full_name} gender={patient.gender} size="lg" /><div className="text-sm font-semibold">{patient.full_name}</div></div>
            <div className="divide-y divide-sand-100">
              <KeyValue label={f.bloodType}>{patient.blood_type ?? '—'}</KeyValue>
              <KeyValue label={f.phone}><span dir="ltr">{patient.phone}</span></KeyValue>
            </div>
          </Card>
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-rose-800"><AlertTriangle className="h-4 w-4" />{d.cl.dr.alerts}</div>
            <AlertsForm patientId={patient.id} allergies={patient.allergies} chronic={patient.chronic_conditions} meds={patient.current_medications} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
