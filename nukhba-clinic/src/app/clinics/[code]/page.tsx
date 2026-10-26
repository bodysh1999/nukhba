import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarPlus, MapPin, Star } from 'lucide-react';
import { getPublicClinics, getPublicDoctors, getPublicServices } from '@/lib/public-data';
import { Avatar, ClinicIcon } from '@/components/clinic-ui';
import { DEEP, getSiteChrome, SiteFrame } from '@/components/site/frame';

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const [{ code }, c, clinics] = await Promise.all([params, getSiteChrome(), getPublicClinics()]);
  const k = clinics.find((x) => x.code === code);
  return { title: k ? (c.ar ? k.name_ar : k.name_en) : c.t.clinicsTitle };
}

export default async function ClinicPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [c, clinics, doctors, services] = await Promise.all([getSiteChrome(), getPublicClinics(), getPublicDoctors(), getPublicServices()]);
  const k = clinics.find((x) => x.code === code && x.is_active);
  if (!k) notFound();
  const { t, ar } = c;
  const docs = doctors.filter((x) => x.clinic_id === k.id && x.is_active && x.show_public);
  const svc = services.filter((s) => s.clinic_id === k.id);
  const bookHref = c.loggedIn && c.isPatient ? `/patient/book?clinic=${k.id}` : `/book?clinic=${k.id}`;
  return (
    <SiteFrame c={c}>
      <section className={`relative isolate overflow-hidden ${DEEP} pb-14 pt-32 text-white sm:pt-40`}>
        <div className="texture-lines absolute inset-0 -z-10 opacity-40" />
        <div className="absolute -end-40 -top-40 -z-10 h-[520px] w-[520px] rounded-full bg-brand blur-3xl" />
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <nav className="mb-6 flex gap-2 text-sm text-white/55"><Link href="/" className="hover:text-white">{t.nav.home}</Link>/<Link href="/clinics" className="hover:text-white">{t.nav.clinics}</Link></nav>
          <div className="flex flex-wrap items-center gap-5">
            <span className="grid h-20 w-20 place-items-center rounded-3xl bg-white/10 ring-1 ring-white/15"><ClinicIcon name={k.icon} className="h-10 w-10 text-accent" /></span>
            <div>
              <h1 className="font-display text-4xl font-bold sm:text-5xl">{ar ? k.name_ar : k.name_en}</h1>
              {(ar ? k.location_ar : k.location_en) && <p className="mt-2 flex items-center gap-1.5 text-white/70"><MapPin className="h-4 w-4 text-accent" />{ar ? k.location_ar : k.location_en}</p>}
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-lg leading-loose text-white/75">{ar ? k.description_ar : k.description_en}</p>
          <Link href={bookHref} className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 font-semibold text-white"><CalendarPlus className="h-4 w-4" />{t.nav.book}</Link>
        </div>
      </section>
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <h2 className="font-display text-3xl font-bold text-brand">{t.clinicDoctors}</h2>
          {docs.length === 0 ? <p className="mt-6 text-ink/60">{t.noDoctors}</p> : (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {docs.map((x) => (
                <Link key={x.id} href={`/doctors/${x.id}`} className="flex gap-4 rounded-[24px] border border-sand-200 bg-white p-5 transition hover:border-brand/30 hover:shadow-lift">
                  <Avatar name={x.full_name_ar} gender={x.gender} photo={x.photo_url} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{!ar && x.full_name_en ? x.full_name_en : x.full_name_ar}</div>
                    <div className="text-sm text-accent">{c.d.cl.title[x.title]}</div>
                    <div className="text-xs text-stone-450">{ar ? x.specialty_ar : x.specialty_en}</div>
                    <div className="mt-2 flex items-center gap-3 text-sm">
                      {x.rating && <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-accent text-accent" />{x.rating.avg}</span>}
                      <span className="text-stone-450">{Number(x.consultation_fee)} {t.sar}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {svc.length > 0 && (
            <div className="mt-14">
              <h2 className="font-display text-2xl font-bold text-brand">{t.clinicServices}</h2>
              <ul className="mt-6 divide-y divide-sand-200 rounded-[24px] border border-sand-200 bg-white">
                {svc.map((s) => <li key={s.id} className="flex items-center justify-between px-6 py-4"><span>{ar ? s.name_ar : s.name_en ?? s.name_ar}</span><span className="font-semibold tabular-nums">{Number(s.price)} {t.sar}</span></li>)}
              </ul>
            </div>
          )}
        </div>
      </section>
    </SiteFrame>
  );
}
