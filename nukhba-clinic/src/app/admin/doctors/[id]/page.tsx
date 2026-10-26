import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { getClinics, riyadhDay } from '@/lib/clinic-data';
import { Avatar } from '@/components/clinic-ui';
import { Card, CardHeader, KeyValue, PageHeader } from '@/components/ui';
import type { Doctor } from '@/lib/types';
import { DoctorForm, DoctorLogin, ShiftEditor, TimeOffEditor } from '../../clinic-forms';

export default async function DoctorAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ d, locale }, supabase, clinics] = await Promise.all([getI18n(), createClient(), getClinics(false)]);
  const { data } = await supabase.from('doctors').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const doc = data as Doctor;
  const a = d.cl.adm;
  const since = riyadhDay(-30).from;
  const [{ data: shifts }, { data: off }, { data: appts }, { data: ratings }, { data: login }] = await Promise.all([
    supabase.from('doctor_schedules').select('id, weekday, start_time, end_time').eq('doctor_id', id).order('start_time'),
    supabase.from('doctor_time_off').select('id, from_date, to_date, reason').eq('doctor_id', id).gte('to_date', riyadhDay().day).order('from_date'),
    supabase.from('appointments').select('status').eq('doctor_id', id).gte('starts_at', since).lte('starts_at', riyadhDay().to),
    supabase.from('appointment_ratings').select('score').eq('doctor_id', id).gte('created_at', since),
    doc.profile_id ? supabase.from('profiles').select('email').eq('id', doc.profile_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const count = (s: string) => (appts ?? []).filter((x) => x.status === s).length;
  const avg = ratings?.length ? Math.round((ratings.reduce((s, r) => s + r.score, 0) / ratings.length) * 10) / 10 : null;
  return (
    <div>
      <PageHeader title={<span className="flex items-center gap-3"><Avatar name={doc.full_name_ar} gender={doc.gender} photo={doc.photo_url} />{locale === 'ar' ? doc.full_name_ar : doc.full_name_en ?? doc.full_name_ar}</span>} subtitle={d.cl.title[doc.title]} />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <Card><CardHeader title={a.schedule} /><div className="p-5"><ShiftEditor doctorId={doc.id} shifts={shifts ?? []} /></div></Card>
          <Card><CardHeader title={d.common.edit} /><div className="p-5"><DoctorForm doctor={doc} clinics={clinics} /></div></Card>
        </div>
        <aside className="space-y-4">
          <Card className="p-5">
            <h3 className="mb-2 font-semibold">{a.stats}</h3>
            <div className="divide-y divide-sand-100">
              <KeyValue label={a.appts}>{(appts ?? []).filter((x) => x.status !== 'cancelled').length}</KeyValue>
              <KeyValue label={a.completedN}>{count('completed')}</KeyValue>
              <KeyValue label={a.noShowN}>{count('no_show')}</KeyValue>
              <KeyValue label={a.kpi.rating}>{avg ?? '—'} <span className="text-xs text-stone-450">({ratings?.length ?? 0})</span></KeyValue>
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 font-semibold">{a.login}</h3>
            {doc.profile_id ? <p className="text-sm"><span className="text-stone-450">{a.hasLogin}:</span> <span dir="ltr">{login?.email}</span></p> : <DoctorLogin doctorId={doc.id} />}
          </Card>
          <Card className="p-5"><h3 className="mb-3 font-semibold">{a.timeOff}</h3><TimeOffEditor doctorId={doc.id} items={off ?? []} /></Card>
        </aside>
      </div>
    </div>
  );
}
