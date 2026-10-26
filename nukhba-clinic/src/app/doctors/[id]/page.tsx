import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Award, CalendarPlus, Clock, Languages, LogIn, Star, UserPlus } from 'lucide-react';
import { anonClient, getDoctorSchedule, getPublicClinics, getPublicDoctors, getPublicInsurers } from '@/lib/public-data';
import { fmt } from '@/lib/i18n';
import { WEEKDAYS } from '@/lib/constants';
import { Avatar, fmtDay, fmtTime } from '@/components/clinic-ui';
import { DEEP, getSiteChrome, SiteFrame } from '@/components/site/frame';
import { BookingRequestForm } from '@/components/site/request-form';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const [{ id }, c, doctors] = await Promise.all([params, getSiteChrome(), getPublicDoctors()]);
  const x = doctors.find((y) => y.id === id);
  return { title: x ? (!c.ar && x.full_name_en ? x.full_name_en : x.full_name_ar) : c.t.doctorsTitle };
}

const LANG: Record<string, [string, string]> = { ar: ['العربية', 'Arabic'], en: ['الإنجليزية', 'English'], fr: ['الفرنسية', 'French'], ur: ['الأوردية', 'Urdu'], hi: ['الهندية', 'Hindi'], tl: ['الفلبينية', 'Filipino'] };

export default async function DoctorProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [c, doctors, clinics, insurers] = await Promise.all([getSiteChrome(), getPublicDoctors(), getPublicClinics(), getPublicInsurers()]);
  const x = doctors.find((y) => y.id === id && y.is_active && y.show_public);
  if (!x) notFound();
  const { t, ar, locale, d } = c;
  const k = clinics.find((y) => y.id === x.clinic_id);
  const schedule = await getDoctorSchedule(x.id);
  const sb = anonClient();
  const { data: days } = await sb.rpc('doctor_open_days', { p_doctor: x.id, p_days: 14 });
  const firstDay = ((days ?? []) as { day: string; free_slots: number }[]).find((y) => y.free_slots > 0)?.day;
  const { data: slots } = firstDay ? await sb.rpc('available_slots', { p_doctor: x.id, p_date: firstDay }) : { data: [] };
  const free = ((slots ?? []) as { starts_at: string; is_free: boolean }[]).filter((s) => s.is_free).slice(0, 8);
  const name = !ar && x.full_name_en ? x.full_name_en : x.full_name_ar;
  const patientBook = `/patient/book?doctor=${x.id}`;
  const t5 = (v: string) => v.slice(0, 5);

  return (
    <SiteFrame c={c}>
      <section className={`relative isolate overflow-hidden ${DEEP} pb-16 pt-32 text-white sm:pt-40`}>
        <div className="texture-lines absolute inset-0 -z-10 opacity-40" />
        <div className="absolute -end-40 -top-40 -z-10 h-[520px] w-[520px] rounded-full bg-brand blur-3xl" />
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <nav className="mb-6 flex gap-2 text-sm text-white/55"><Link href="/" className="hover:text-white">{t.nav.home}</Link>/<Link href="/doctors" className="hover:text-white">{t.nav.doctors}</Link></nav>
          <div className="flex flex-wrap items-center gap-6">
            <Avatar name={x.full_name_ar} gender={x.gender} photo={x.photo_url} size="xl" className="ring-4 ring-white/10" />
            <div>
              <h1 className="font-display text-4xl font-bold sm:text-5xl">{name}</h1>
              <p className="mt-2 text-lg text-accent">{d.cl.title[x.title]} · {k ? (ar ? k.name_ar : k.name_en) : ''}</p>
              <p className="text-white/70">{ar ? x.specialty_ar : x.specialty_en}</p>
              {x.rating && <p className="mt-2 inline-flex items-center gap-1.5 text-sm"><Star className="h-4 w-4 fill-accent text-accent" />{fmt(t.rating, { r: x.rating.avg, n: x.rating.n })}</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-[1fr_420px]">
          <div className="space-y-8">
            <div className="rounded-[28px] border border-sand-200 bg-white p-7">
              <h2 className="text-xl font-semibold">{t.about}</h2>
              <p className="mt-3 leading-loose text-ink/75">{ar ? x.bio_ar : x.bio_en}</p>
              <ul className="mt-6 grid gap-4 sm:grid-cols-3">
                {x.years_experience ? <li className="flex items-center gap-3"><Award className="h-5 w-5 text-accent" /><span className="text-sm">{fmt(d.cl.f.experience, { n: x.years_experience })}</span></li> : null}
                {x.qualifications && <li className="flex items-center gap-3"><Award className="h-5 w-5 text-accent" /><span className="text-sm">{x.qualifications}</span></li>}
                <li className="flex items-center gap-3"><Languages className="h-5 w-5 text-accent" /><span className="text-sm">{x.languages.map((l) => LANG[l]?.[ar ? 0 : 1] ?? l).join(' · ')}</span></li>
              </ul>
            </div>
            <div className="rounded-[28px] border border-sand-200 bg-white p-7">
              <h2 className="flex items-center gap-2 text-xl font-semibold"><Clock className="h-5 w-5 text-accent" />{t.availability}</h2>
              <ul className="mt-4 divide-y divide-sand-100">
                {WEEKDAYS.map((w) => {
                  const list = schedule.filter((s) => s.weekday === w);
                  return <li key={w} className="flex justify-between py-2.5 text-sm"><span className="font-medium">{d.cl.weekday[w]}</span><span className="text-stone-450" dir="ltr">{list.length ? list.map((s) => `${t5(s.start_time)} – ${t5(s.end_time)}`).join(' · ') : '—'}</span></li>;
                })}
              </ul>
            </div>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[28px] border-2 border-brand/15 bg-white p-6 shadow-card">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-stone-450">{d.cl.f.fee}</span>
                <span className="font-display text-3xl font-bold text-brand">{Number(x.consultation_fee)} <span className="text-base font-normal">{t.sar}</span></span>
              </div>
              <div className="mt-1 text-end text-xs text-stone-450">{d.cl.f.followFee}: {Number(x.follow_up_fee)} {t.sar}</div>
              {firstDay && free.length > 0 && (
                <div className="mt-5">
                  <div className="text-sm font-medium">{d.cl.book.nextAvailable} · {fmtDay(`${firstDay}T12:00:00+03:00`, locale)}</div>
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {free.map((s) => <Link key={s.starts_at} href={c.isPatient ? patientBook : `/login?next=${encodeURIComponent(patientBook)}`} className="grid h-9 place-items-center rounded-lg border border-sand-200 text-xs font-medium tabular-nums hover:border-brand hover:text-brand">{fmtTime(s.starts_at, locale)}</Link>)}
                  </div>
                </div>
              )}
              {c.isPatient ? (
                <Link href={patientBook} className="mt-5 flex h-12 items-center justify-center gap-2 rounded-2xl bg-accent font-semibold text-white"><CalendarPlus className="h-4 w-4" />{fmt(t.bookWith, { name })}</Link>
              ) : x.accepts_online ? (
                <div className="mt-5 grid gap-2">
                  <Link href={`/login?next=${encodeURIComponent(patientBook)}`} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-accent font-semibold text-white"><LogIn className="h-4 w-4" />{t.loginToBook}</Link>
                  <Link href={`/register?next=${encodeURIComponent(patientBook)}`} className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-sand-300 text-sm font-medium"><UserPlus className="h-4 w-4" />{t.nav.register}</Link>
                </div>
              ) : null}
            </div>
            {!c.isPatient && (
              <div className="rounded-[28px] border border-sand-200 bg-white p-6">
                <h3 className="font-semibold">{t.requestTitle}</h3>
                <p className="mb-4 mt-1 text-sm text-stone-450">{t.orRequest}</p>
                <BookingRequestForm clinics={clinics.map((y) => ({ id: y.id, name_ar: y.name_ar, name_en: y.name_en }))}
                  doctors={doctors.map((y) => ({ id: y.id, clinic_id: y.clinic_id, full_name_ar: y.full_name_ar, full_name_en: y.full_name_en }))}
                  insurers={insurers} initialDoctor={x.id} />
              </div>
            )}
          </aside>
        </div>
      </section>
    </SiteFrame>
  );
}
