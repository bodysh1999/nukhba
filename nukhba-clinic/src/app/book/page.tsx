import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LogIn, UserPlus, Zap } from 'lucide-react';
import { getPublicClinics, getPublicDoctors, getPublicInsurers } from '@/lib/public-data';
import { getSiteChrome, PageHero, SiteFrame } from '@/components/site/frame';
import { BookingRequestForm } from '@/components/site/request-form';

export async function generateMetadata(): Promise<Metadata> {
  const c = await getSiteChrome();
  return { title: c.t.nav.book };
}

export default async function BookPage({ searchParams }: { searchParams: Promise<{ doctor?: string; clinic?: string }> }) {
  const sp = await searchParams;
  const [c, clinics, doctors, insurers] = await Promise.all([getSiteChrome(), getPublicClinics(), getPublicDoctors(), getPublicInsurers()]);
  const q = new URLSearchParams(Object.entries({ doctor: sp.doctor, clinic: sp.clinic }).filter(([, v]) => v) as [string, string][]).toString();
  if (c.isPatient) redirect(`/patient/book${q ? `?${q}` : ''}`);
  const { t, d } = c;
  const next = `/patient/book${q ? `?${q}` : ''}`;
  return (
    <SiteFrame c={c}>
      <PageHero title={d.cl.book.title} body={d.cl.book.sub} crumbs={[{ href: '/', label: t.nav.home }, { href: '/book', label: t.nav.book }]} />
      <section className="py-12 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 sm:px-8 lg:grid-cols-[380px_1fr]">
          <div className="rounded-[28px] bg-brand p-7 text-white shadow-lift">
            <Zap className="h-8 w-8 text-accent" />
            <h2 className="mt-4 text-xl font-semibold">{t.why[0][0]}</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/75">{t.why[0][1]}</p>
            <div className="mt-6 grid gap-2">
              <Link href={`/login?next=${encodeURIComponent(next)}`} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-accent font-semibold"><LogIn className="h-4 w-4" />{t.loginToBook}</Link>
              <Link href={`/register?next=${encodeURIComponent(next)}`} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/25 font-medium"><UserPlus className="h-4 w-4" />{t.nav.register}</Link>
            </div>
          </div>
          <div className="rounded-[28px] border border-sand-200 bg-white p-6 sm:p-8">
            <h2 className="text-xl font-semibold">{t.requestTitle}</h2>
            <p className="mb-6 mt-1 text-sm text-stone-450">{t.requestSub}</p>
            <BookingRequestForm clinics={clinics.filter((k) => k.is_active).map((k) => ({ id: k.id, name_ar: k.name_ar, name_en: k.name_en }))}
              doctors={doctors.filter((x) => x.is_active && x.show_public).map((x) => ({ id: x.id, clinic_id: x.clinic_id, full_name_ar: x.full_name_ar, full_name_en: x.full_name_en }))}
              insurers={insurers} initialDoctor={sp.doctor} initialClinic={sp.clinic} />
          </div>
        </div>
      </section>
    </SiteFrame>
  );
}
