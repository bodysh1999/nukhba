import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, BellRing, CalendarCheck2, CalendarPlus, Clock, FileHeart, MapPin, MessageCircle, Phone, ShieldCheck, ShieldPlus, Star, Stethoscope, Timer,
} from 'lucide-react';
import { anonClient, getPublicClinics, getPublicDoctors, getPublicInsurers, mapEmbed, mapLink } from '@/lib/public-data';
import { fmt } from '@/lib/i18n';
import { Avatar, ClinicIcon, fmtDay, fmtTime } from '@/components/clinic-ui';
import { DEEP, getSiteChrome, SiteFrame } from '@/components/site/frame';

export async function generateMetadata(): Promise<Metadata> {
  const c = await getSiteChrome();
  return { title: { absolute: `${c.name} — ${c.tagline}` }, description: c.t.footerAbout };
}

export default async function Home() {
  const [c, clinics, doctors, insurers] = await Promise.all([getSiteChrome(), getPublicClinics(), getPublicDoctors(), getPublicInsurers()]);
  const { t, ar, locale, s } = c;
  const active = clinics.filter((x) => x.is_active);
  const docs = doctors.filter((x) => x.is_active && x.show_public);
  const rated = docs.filter((x) => x.rating);
  const totalRatings = rated.reduce((n, x) => n + (x.rating?.n ?? 0), 0);
  const avgRating = totalRatings ? Math.round((rated.reduce((n, x) => n + (x.rating!.avg * x.rating!.n), 0) / totalRatings) * 10) / 10 : null;
  const featured = [...docs].sort((a, b) => (b.rating?.n ?? 0) - (a.rating?.n ?? 0)).slice(0, 8);
  const Go = ar ? ArrowLeft : ArrowRight;
  const bookHref = c.loggedIn && c.isPatient ? '/patient/book' : '/book';
  const dName = (x: { full_name_ar: string; full_name_en: string | null }) => (!ar && x.full_name_en ? x.full_name_en : x.full_name_ar);
  const cName = (id: string) => { const k = clinics.find((x) => x.id === id); return k ? (ar ? k.name_ar : k.name_en) : ''; };

  // next free time for three doctors (the hero card shows what booking feels like)
  const sb = anonClient();
  const soon = await Promise.all(featured.filter((x) => x.accepts_online).slice(0, 3).map(async (x) => {
    const { data: days } = await sb.rpc('doctor_open_days', { p_doctor: x.id, p_days: 10 });
    const day = ((days ?? []) as { day: string; free_slots: number }[]).find((y) => y.free_slots > 0)?.day;
    if (!day) return { x, at: null as string | null };
    const { data: slots } = await sb.rpc('available_slots', { p_doctor: x.id, p_date: day });
    return { x, at: ((slots ?? []) as { starts_at: string; is_free: boolean }[]).find((y) => y.is_free)?.starts_at ?? null };
  }));

  const why = [CalendarCheck2, FileHeart, BellRing, ShieldCheck];
  const embed = mapEmbed(s.map_query);

  return (
    <SiteFrame c={c}>
      {/* ---------------------------------------------------------------- hero */}
      <section className={`relative isolate overflow-hidden ${DEEP} pb-20 pt-32 text-white sm:pt-40 lg:pb-28`}>
        <div className="texture-lines absolute inset-0 -z-10 opacity-40" />
        <div className="absolute -end-48 -top-48 -z-10 h-[640px] w-[640px] rounded-full bg-brand blur-3xl" />
        <div className="absolute -bottom-40 -start-20 -z-10 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="rise-in inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.06] px-4 py-1.5 text-sm text-white/80"><Stethoscope className="h-4 w-4 text-accent" />{t.hero.eyebrow}</p>
            <h1 className="rise-in mt-6 font-display text-[44px] font-bold leading-[1.15] sm:text-6xl lg:text-7xl">
              {t.hero.title}<br /><span className="text-accent">{t.hero.titleAccent}</span>
            </h1>
            <p className="rise-in-2 mt-6 max-w-xl text-lg leading-loose text-white/75">{fmt(t.hero.body, { n: active.length })}</p>
            <div className="rise-in-3 mt-9 flex flex-wrap gap-3">
              <Link href={bookHref} className="inline-flex h-14 items-center gap-2 rounded-full bg-accent px-7 text-base font-semibold text-white shadow-lift transition hover:bg-accent/90"><CalendarPlus className="h-5 w-5" />{t.hero.cta}</Link>
              <Link href="/doctors" className="inline-flex h-14 items-center gap-2 rounded-full border border-white/25 px-7 text-base font-medium transition hover:bg-white/10">{t.hero.cta2}<Go className="h-4 w-4" /></Link>
            </div>
            <div className="rise-in-3 mt-10 flex flex-wrap items-center gap-6 text-sm text-white/70">
              {avgRating && <span className="inline-flex items-center gap-1.5"><Star className="h-4 w-4 fill-accent text-accent" /><b className="text-white">{avgRating}</b> · {totalRatings.toLocaleString('en-US')} {ar ? 'تقييم' : 'ratings'}</span>}
              <span className="inline-flex items-center gap-1.5"><ShieldPlus className="h-4 w-4 text-accent" />{insurers.length} {ar ? 'شركات تأمين' : 'insurers'}</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4 text-accent" />{ar ? s.working_hours_ar : s.working_hours_en}</span>
            </div>
          </div>

          {/* booking preview */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="rise-in-2 rounded-[28px] bg-white p-5 text-ink shadow-[0_40px_80px_-30px_rgba(0,0,0,.55)] sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-semibold">{c.d.cl.book.nextAvailable}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />{ar ? 'متاح الآن' : 'Live'}</span>
              </div>
              <ul className="space-y-2.5">
                {soon.map(({ x, at }) => (
                  <li key={x.id}>
                    <Link href={`/doctors/${x.id}`} className="flex items-center gap-3 rounded-2xl border border-sand-200 p-3 transition hover:border-brand/30 hover:bg-sand-50">
                      <Avatar name={x.full_name_ar} gender={x.gender} photo={x.photo_url} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{dName(x)}</div>
                        <div className="truncate text-xs text-stone-450">{cName(x.clinic_id)}</div>
                      </div>
                      {at && <div className="text-end"><div className="text-sm font-semibold tabular-nums text-brand">{fmtTime(at, locale)}</div><div className="text-[11px] text-stone-450">{fmtDay(at, locale, { weekday: 'short', day: 'numeric', month: 'short' })}</div></div>}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href={bookHref} className="mt-4 flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand text-sm font-semibold text-white transition hover:bg-brand/90"><CalendarPlus className="h-4 w-4" />{t.nav.book}</Link>
            </div>
            <div className="rise-in-3 absolute -bottom-8 -start-4 hidden items-center gap-3 rounded-2xl bg-accent px-4 py-3 text-white shadow-lift sm:flex">
              <Timer className="h-5 w-5" />
              <div className="text-sm leading-tight"><div className="text-white/80">{ar ? 'رقم دورك' : 'Your queue no.'}</div><div className="font-display text-xl font-bold">#07</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- stats */}
      <section className="relative z-10 -mt-10">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-px overflow-hidden rounded-3xl border border-sand-200 bg-sand-200 shadow-card sm:grid-cols-4">
          {[[docs.length, t.stats.doctors], [active.length, t.stats.clinics], [totalRatings ? `${totalRatings.toLocaleString('en-US')}+` : '—', t.stats.patients], [avgRating ? `${avgRating}/5` : '—', t.stats.rating]].map(([v, l]) => (
            <div key={String(l)} className="bg-white px-5 py-6 text-center">
              <div className="font-display text-3xl font-bold text-brand tabular-nums">{v}</div>
              <div className="mt-1 text-sm text-stone-450">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- clinics */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><h2 className="font-display text-3xl font-bold text-brand sm:text-4xl">{t.clinicsTitle}</h2><p className="mt-2 text-ink/60">{t.clinicsSub}</p></div>
            <Link href="/clinics" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">{t.nav.clinics}<Go className="h-4 w-4" /></Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {active.map((k) => (
              <Link key={k.id} href={`/clinics/${k.code}`} className="group relative overflow-hidden rounded-[24px] border border-sand-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lift">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/[.07] text-brand transition group-hover:bg-brand group-hover:text-white"><ClinicIcon name={k.icon} className="h-7 w-7" /></span>
                <h3 className="mt-5 text-lg font-semibold">{ar ? k.name_ar : k.name_en}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink/60">{ar ? k.description_ar : k.description_en}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent">{t.viewClinic}<Go className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- doctors */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><h2 className="font-display text-3xl font-bold text-brand sm:text-4xl">{t.doctorsTitle}</h2><p className="mt-2 text-ink/60">{t.doctorsSub}</p></div>
            <Link href="/doctors" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">{t.allDoctors}<Go className="h-4 w-4" /></Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((x) => (
              <Link key={x.id} href={`/doctors/${x.id}`} className="group rounded-[24px] border border-sand-200 bg-sand-50/60 p-5 transition hover:border-brand/30 hover:bg-white hover:shadow-lift">
                <div className="flex items-start justify-between">
                  <Avatar name={x.full_name_ar} gender={x.gender} photo={x.photo_url} size="lg" />
                  {x.rating && <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs font-semibold shadow-sm"><Star className="h-3 w-3 fill-accent text-accent" />{x.rating.avg}</span>}
                </div>
                <h3 className="mt-4 font-semibold">{dName(x)}</h3>
                <p className="text-sm text-accent">{c.d.cl.title[x.title]} · {cName(x.clinic_id)}</p>
                <p className="mt-1 line-clamp-1 text-xs text-stone-450">{ar ? x.specialty_ar : x.specialty_en}</p>
                <div className="mt-4 flex items-center justify-between border-t border-sand-200 pt-3 text-sm">
                  <span className="text-stone-450">{t.from} <b className="text-ink">{Number(x.consultation_fee)}</b> {t.sar}</span>
                  <span className="font-medium text-brand">{t.viewProfile}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- why */}
      <section className="texture-lines bg-brand py-20 text-white sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">{t.whyTitle}</h2>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {t.why.map(([title, body], i) => {
              const Icon = why[i];
              return (
                <li key={title} className="rounded-[24px] bg-white/[.07] p-6 ring-1 ring-white/10">
                  <Icon className="h-8 w-8 text-accent" strokeWidth={1.6} />
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{body}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------------- insurance */}
      <section id="insurance" className="scroll-mt-24 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 text-center sm:px-8">
          <ShieldPlus className="mx-auto h-10 w-10 text-accent" strokeWidth={1.5} />
          <h2 className="mt-4 font-display text-3xl font-bold text-brand sm:text-4xl">{t.insuranceTitle}</h2>
          <p className="mt-2 text-ink/60">{t.insuranceSub}</p>
          <ul className="mx-auto mt-10 flex max-w-4xl flex-wrap justify-center gap-3">
            {insurers.map((i) => (
              <li key={i.id} className="rounded-2xl border border-sand-200 bg-white px-6 py-4 text-base font-semibold text-ink/80 shadow-card">{ar ? i.name_ar : i.name_en ?? i.name_ar}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------------- CTA */}
      <section className="px-5 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 overflow-hidden rounded-[32px] bg-gradient-to-br from-accent to-[#9A6C2C] p-8 text-white shadow-lift sm:p-12 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-3xl font-bold">{t.ctaTitle}</h2>
            <p className="mt-2 max-w-xl text-white/85">{t.ctaBody}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={bookHref} className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-accent transition hover:bg-white/90"><CalendarPlus className="h-4 w-4" />{t.nav.book}</Link>
            {!c.loggedIn && <Link href="/register" className="inline-flex h-12 items-center rounded-full border border-white/40 px-6 font-medium transition hover:bg-white/10">{t.nav.register}</Link>}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- contact */}
      <section id="contact" className="scroll-mt-24 py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="font-display text-3xl font-bold text-brand sm:text-4xl">{t.contactTitle}</h2>
            <dl className="mt-8 space-y-6">
              <div className="flex gap-4"><MapPin className="mt-1 h-5 w-5 text-accent" /><div><dt className="text-sm text-stone-450">{t.address}</dt><dd className="font-medium">{ar ? s.address_ar : s.address_en}</dd>
                {mapLink(s.map_query) && <a href={mapLink(s.map_query)!} target="_blank" rel="noreferrer" className="text-sm text-brand hover:underline">Google Maps</a>}</div></div>
              <div className="flex gap-4"><Clock className="mt-1 h-5 w-5 text-accent" /><div><dt className="text-sm text-stone-450">{t.hours}</dt><dd className="font-medium">{ar ? s.working_hours_ar : s.working_hours_en}</dd></div></div>
              <div className="flex flex-wrap gap-3 pt-2">
                {s.support_phone && <a href={`tel:${s.support_phone}`} className="inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 font-medium text-white"><Phone className="h-4 w-4" /><span dir="ltr">{s.support_phone}</span></a>}
                {s.whatsapp && <a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center gap-2 rounded-full bg-emerald-600 px-6 font-medium text-white"><MessageCircle className="h-4 w-4" />{t.whatsapp}</a>}
              </div>
            </dl>
          </div>
          {embed && <iframe src={embed} title={t.contactTitle} loading="lazy" className="h-80 w-full rounded-[28px] border border-sand-200 lg:h-full lg:min-h-[340px]" />}
        </div>
      </section>
    </SiteFrame>
  );
}
