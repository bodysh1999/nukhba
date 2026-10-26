import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, MapPin } from 'lucide-react';
import { getPublicClinics, getPublicDoctors } from '@/lib/public-data';
import { ClinicIcon } from '@/components/clinic-ui';
import { getSiteChrome, PageHero, SiteFrame } from '@/components/site/frame';

export async function generateMetadata(): Promise<Metadata> {
  const c = await getSiteChrome();
  return { title: c.t.clinicsTitle, description: c.t.clinicsSub };
}

export default async function ClinicsPage() {
  const [c, clinics, doctors] = await Promise.all([getSiteChrome(), getPublicClinics(), getPublicDoctors()]);
  const { t, ar } = c;
  const Go = ar ? ArrowLeft : ArrowRight;
  return (
    <SiteFrame c={c}>
      <PageHero title={t.clinicsTitle} body={t.clinicsSub} crumbs={[{ href: '/', label: t.nav.home }, { href: '/clinics', label: t.nav.clinics }]} />
      <section className="py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 sm:grid-cols-2 sm:px-8 lg:grid-cols-3">
          {clinics.filter((k) => k.is_active).map((k) => {
            const n = doctors.filter((x) => x.clinic_id === k.id && x.is_active && x.show_public).length;
            return (
              <Link key={k.id} href={`/clinics/${k.code}`} className="group flex flex-col rounded-[28px] border border-sand-200 bg-white p-7 transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lift">
                <div className="flex items-start justify-between">
                  <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand/[.07] text-brand transition group-hover:bg-brand group-hover:text-white"><ClinicIcon name={k.icon} className="h-8 w-8" /></span>
                  <span className="rounded-full bg-sand-100 px-3 py-1 text-xs font-medium text-ink/70">{n} {c.d.cl.f.doctors}</span>
                </div>
                <h2 className="mt-6 font-display text-2xl font-bold">{ar ? k.name_ar : k.name_en}</h2>
                <p className="mt-3 flex-1 leading-relaxed text-ink/65">{ar ? k.description_ar : k.description_en}</p>
                {(ar ? k.location_ar : k.location_en) && <p className="mt-4 flex items-center gap-1.5 text-sm text-stone-450"><MapPin className="h-4 w-4 text-accent" />{ar ? k.location_ar : k.location_en}</p>}
                <span className="mt-5 inline-flex items-center gap-1.5 font-semibold text-brand">{t.viewClinic}<Go className="h-4 w-4" /></span>
              </Link>
            );
          })}
        </div>
      </section>
    </SiteFrame>
  );
}
