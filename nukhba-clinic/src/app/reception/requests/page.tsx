import Link from 'next/link';
import { CalendarPlus, Inbox, MessageCircle, Phone } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { Badge, Card, EmptyState, PageHeader, buttonClass, cx } from '@/components/ui';
import { fmtDate, fmtRelative } from '@/lib/format';
import { RequestActions } from '../desk-client';

export const metadata = { title: 'طلبات الموقع' };
type Req = {
  id: string; ref_no: string; full_name: string; phone: string; email: string | null; preferred_date: string | null; preferred_time: string | null;
  insurance_name: string | null; message: string | null; status: string; created_at: string; appointment_id: string | null;
  clinics: { name_ar: string; name_en: string } | null; doctors: { id: string; full_name_ar: string; full_name_en: string | null } | null;
  appointments: { ref_no: string } | null;
};
const TONE: Record<string, string> = {
  new: 'bg-sky-50 text-sky-800 ring-sky-200', contacted: 'bg-amber-50 text-amber-800 ring-amber-200',
  booked: 'bg-emerald-50 text-emerald-800 ring-emerald-200', cancelled: 'bg-stone-100 text-stone-600 ring-stone-200',
};

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const sp = await searchParams;
  const [{ d, locale }, supabase] = await Promise.all([getI18n(), createClient()]);
  const k = d.cl.desk;
  let q = supabase.from('booking_requests').select('*, clinics(name_ar, name_en), doctors(id, full_name_ar, full_name_en), appointments(ref_no)').order('created_at', { ascending: false }).limit(100);
  if (!sp.all) q = q.in('status', ['new', 'contacted']);
  const { data } = await q;
  const rows = (data ?? []) as Req[];
  return (
    <div>
      <PageHeader title={k.requests} subtitle={k.requestsSub}
        actions={<Link href={sp.all ? '/reception/requests' : '/reception/requests?all=1'} className={buttonClass('outline')}>{sp.all ? k.reqStatus.new : d.common.all}</Link>} />
      {rows.length === 0 ? <Card><EmptyState icon={<Inbox className="h-5 w-5" />} title={d.common.noData} /></Card> : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => (
            <Card key={r.id} className={cx('p-5', r.status === 'new' && 'border-sky-200')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{r.full_name}</div>
                  <div className="mt-0.5 text-xs text-stone-450"><span dir="ltr">{r.ref_no}</span> · {fmtRelative(r.created_at, locale)}</div>
                </div>
                <Badge className={TONE[r.status]}>{k.reqStatus[r.status as keyof typeof k.reqStatus]}</Badge>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div><dt className="text-xs text-stone-450">{d.cl.f.clinic}</dt><dd>{r.clinics ? (locale === 'ar' ? r.clinics.name_ar : r.clinics.name_en) : '—'}</dd></div>
                <div><dt className="text-xs text-stone-450">{d.cl.f.doctor}</dt><dd>{r.doctors ? (locale === 'ar' ? r.doctors.full_name_ar : r.doctors.full_name_en ?? r.doctors.full_name_ar) : '—'}</dd></div>
                <div><dt className="text-xs text-stone-450">{k.preferred}</dt><dd>{r.preferred_date ? fmtDate(r.preferred_date, locale) : '—'}{r.preferred_time ? ` · ${k.time[r.preferred_time as keyof typeof k.time]}` : ''}</dd></div>
                <div><dt className="text-xs text-stone-450">{k.insuranceName}</dt><dd>{r.insurance_name ?? '—'}</dd></div>
              </dl>
              {r.message && <p className="mt-3 rounded-xl bg-sand-50 p-3 text-sm text-ink/80">{r.message}</p>}
              {r.appointments && <p className="mt-3 text-sm text-emerald-700">{k.linkAppt} <span dir="ltr">{r.appointments.ref_no}</span></p>}
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-sand-100 pt-4">
                <a href={`tel:${r.phone}`} className={buttonClass('outline', 'sm')}><Phone className="h-3.5 w-3.5" /><span dir="ltr">{r.phone}</span></a>
                <a href={`https://wa.me/${r.phone.replace(/^0/, '966').replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className={buttonClass('outline', 'sm')}><MessageCircle className="h-3.5 w-3.5" />{d.cl.site.whatsapp}</a>
                {r.status !== 'booked' && r.status !== 'cancelled' && (
                  <Link href={`/reception/book?q=${encodeURIComponent(r.phone)}&request=${r.id}${r.doctors ? `&doctor=${r.doctors.id}` : ''}`} className={buttonClass('accent', 'sm')}><CalendarPlus className="h-3.5 w-3.5" />{k.bookFromRequest}</Link>
                )}
                <div className="ms-auto"><RequestActions id={r.id} status={r.status} /></div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
