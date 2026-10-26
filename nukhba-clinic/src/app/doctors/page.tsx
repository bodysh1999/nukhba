import type { Metadata } from 'next';
import Link from 'next/link';
import { Search, Star } from 'lucide-react';
import { getPublicClinics, getPublicDoctors } from '@/lib/public-data';
import { Avatar } from '@/components/clinic-ui';
import { cx } from '@/components/ui';
import { getSiteChrome, PageHero, SiteFrame } from '@/components/site/frame';

export async function generateMetadata(): Promise<Metadata> {
  const c = await getSiteChrome();
  return { title: c.t.doctorsTitle, description: c.t.doctorsSub };
}

export default async function DoctorsPage({ searchParams }: { searchParams: Promise<{ clinic?: string; g?: string; q?: string }> }) {
  const sp = await searchParams;
  const [c, clinics, doctors] = await Promise.all([getSiteChrome(), getPublicClinics(), getPublicDoctors()]);
  const { t, ar } = c;
  const q = (sp.q ?? '').trim().toLowerCase();
  const list = doctors.filter((x) => x.is_active && x.show_public
    && (!sp.clinic || clinics.find((k) => k.id === x.clinic_id)?.code === sp.clinic)
    && (!sp.g || x.gender === sp.g)
    && (!q || [x.full_name_ar, x.full_name_en, x.specialty_ar, x.specialty_en].some((v) => v?.toLowerCase().includes(q))));
  const href = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ clinic: sp.clinic, g: sp.g, q: sp.q, ...extra }).filter(([, v]) => v) as [string, string][]);
    return `/doctors${p.toString() ? `?${p}` : ''}`;
  };
  const chip = (on: boolean) => cx('inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm transition', on ? 'border-brand bg-brand text-white' : 'border-sand-200 bg-white text-ink/75 hover:border-brand/30');
  return (
    <SiteFrame c={c}>
      <PageHero title={t.doctorsTitle} body={t.doctorsSub} crumbs={[{ href: '/', label: t.nav.home }, { href: '/doctors', label: t.nav.doctors }]}>
        <form action="/doctors" className="relative max-w-xl">
          {sp.clinic && <input type="hidden" name="clinic" value={sp.clinic} />}
          <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-450" />
          <input name="q" defaultValue={sp.q} placeholder={t.searchDoctor} className="h-14 w-full rounded-full border-0 bg-white ps-12 pe-5 text-ink outline-none ring-4 ring-white/10" />
        </form>
      </PageHero>
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
            <Link href={href({ clinic: undefined })} className={chip(!sp.clinic)}>{t.filterClinic}</Link>
            {clinics.filter((k) => k.is_active).map((k) => <Link key={k.id} href={href({ clinic: k.code })} className={chip(sp.clinic === k.code)}>{ar ? k.name_ar : k.name_en}</Link>)}
          </div>
          <div className="mt-2 flex gap-2">
            {[[undefined, t.filterGender], ['male', t.male], ['female', t.female]].map(([g, l]) => <Link key={String(g)} href={href({ g })} className={chip(sp.g === g)}>{l}</Link>)}
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((x) => {
              const k = clinics.find((y) => y.id === x.clinic_id);
              return (
                <Link key={x.id} href={`/doctors/${x.id}`} className="group flex gap-4 rounded-[24px] border border-sand-200 bg-white p-5 transition hover:border-brand/30 hover:shadow-lift">
                  <Avatar name={x.full_name_ar} gender={x.gender} photo={x.photo_url} size="xl" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{!ar && x.full_name_en ? x.full_name_en : x.full_name_ar}</div>
                    <div className="text-sm text-accent">{c.d.cl.title[x.title]} · {k ? (ar ? k.name_ar : k.name_en) : ''}</div>
                    <div className="mt-0.5 line-clamp-1 text-xs text-stone-450">{ar ? x.specialty_ar : x.specialty_en}</div>
                    <div className="mt-3 flex items-center gap-3 text-sm">
                      {x.rating ? <span className="inline-flex items-center gap-1 font-medium"><Star className="h-3.5 w-3.5 fill-accent text-accent" />{x.rating.avg} <span className="text-xs text-stone-450">({x.rating.n})</span></span> : <span className="text-xs text-stone-450">{t.newDoctor}</span>}
                      <span className="text-stone-450">{t.from} <b className="text-ink">{Number(x.consultation_fee)}</b> {t.sar}</span>
                    </div>
                    <span className="mt-3 inline-block text-sm font-semibold text-brand">{t.viewProfile}</span>
                  </div>
                </Link>
              );
            })}
          </div>
          {list.length === 0 && <p className="py-16 text-center text-ink/60">{t.noDoctors}</p>}
        </div>
      </section>
    </SiteFrame>
  );
}
