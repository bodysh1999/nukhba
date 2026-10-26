import Link from 'next/link';
import type { ReactNode } from 'react';
import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { getCurrentProfile, getI18n, getSettings, homeFor } from '@/lib/session';
import { pagesContent } from '@/lib/site-pages';
import { fmt } from '@/lib/i18n';
import { DEFAULT_LOGO } from '../brand';
import { SiteHeader } from './header';

export const DEEP = 'bg-[#0B3640]';

/** Everything the public pages share: texts, center settings, signed-in state */
export async function getSiteChrome() {
  const [{ locale, d }, s, profile] = await Promise.all([getI18n(), getSettings(), getCurrentProfile()]);
  const loggedIn = !!profile?.is_active;
  return {
    locale, s, d,
    t: d.cl.site,
    pg: pagesContent(locale),
    ar: locale === 'ar',
    name: locale === 'ar' ? s.name_ar : s.name_en,
    tagline: (locale === 'ar' ? s.tagline_ar : s.tagline_en) ?? '',
    logo: s.logo_url || DEFAULT_LOGO,
    loggedIn,
    isPatient: profile?.role === 'patient',
    portalHref: loggedIn ? homeFor(profile!.role) : '/login',
  };
}
export type SiteChrome = Awaited<ReturnType<typeof getSiteChrome>>;

export function SiteFrame({ c, children, solidHeader = false }: { c: SiteChrome; children: ReactNode; solidHeader?: boolean }) {
  return (
    <div id="top" className="overflow-x-clip bg-sand-50 text-ink">
      <SiteHeader nav={c.t.nav} staffLabel={c.t.staff} verifyLabel={c.t.verify} logo={c.logo} name={c.name} tagline={c.tagline}
        portalHref={c.portalHref} loggedIn={c.loggedIn} isPatient={c.isPatient} solidAlways={solidHeader}
        contact={{ phone: c.s.support_phone, email: c.s.support_email, address: c.ar ? c.s.address_ar ?? null : c.s.address_en ?? null }} />
      <main>{children}</main>
      <SiteFooter c={c} />
      {c.s.whatsapp && (
        <a href={`https://wa.me/${c.s.whatsapp}`} target="_blank" rel="noreferrer" aria-label={c.t.whatsapp}
          className="fixed bottom-5 end-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-emerald-600 text-white shadow-lift transition hover:scale-105 hover:bg-emerald-700">
          <MessageCircle className="h-6 w-6" />
        </a>
      )}
    </div>
  );
}

/** Title band for inner pages */
export function PageHero({ eyebrow, title, body, crumbs, children }: {
  eyebrow?: string; title: string; body?: string; crumbs?: { href: string; label: string }[]; children?: ReactNode;
}) {
  return (
    <section className={`relative isolate overflow-hidden ${DEEP} pb-14 pt-32 text-white sm:pb-16 sm:pt-40`}>
      <div className="texture-lines absolute inset-0 -z-10 opacity-40" />
      <div className="absolute -end-40 -top-40 -z-10 h-[520px] w-[520px] rounded-full bg-brand blur-3xl" />
      <div className="absolute -bottom-32 start-[10%] -z-10 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {crumbs && (
          <nav aria-label="breadcrumb" className="rise-in mb-6 flex flex-wrap items-center gap-2 text-sm text-white/55">
            {crumbs.map((c, i) => (
              <span key={c.href} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden>/</span>}
                <Link href={c.href} className="hover:text-white">{c.label}</Link>
              </span>
            ))}
          </nav>
        )}
        {eyebrow && <p className="rise-in text-sm text-accent">{eyebrow}</p>}
        <h1 className="rise-in mt-3 max-w-4xl font-display text-4xl font-bold leading-[1.2] sm:text-5xl lg:text-6xl">{title}</h1>
        {body && <p className="rise-in-2 mt-5 max-w-2xl text-lg leading-loose text-white/75">{body}</p>}
        {children && <div className="rise-in-3 mt-8">{children}</div>}
      </div>
    </section>
  );
}

export function SiteFooter({ c }: { c: SiteChrome }) {
  const { t, s, name, logo, portalHref, ar } = c;
  const col = 'mb-4 text-sm font-semibold text-accent';
  const link = 'transition hover:text-white';
  const socials = [
    s.instagram_url && { href: s.instagram_url, label: 'Instagram' }, s.x_url && { href: s.x_url, label: 'X' },
    s.snapchat_url && { href: s.snapchat_url, label: 'Snapchat' }, s.tiktok_url && { href: s.tiktok_url, label: 'TikTok' },
  ].filter(Boolean) as { href: string; label: string }[];
  return (
    <footer className={`${DEEP} text-white`}>
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt="" className="h-8 w-8" />
            </span>
            <span className="font-display text-lg font-bold">{name}</span>
          </div>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/55">{t.footerAbout}</p>
          {s.moh_license && <p className="mt-3 text-xs text-white/40">{fmt(t.licensed, { n: s.moh_license })}</p>}
          {socials.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {socials.map((l) => <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs text-white/70 transition hover:border-white/40 hover:text-white">{l.label}</a>)}
            </div>
          )}
        </div>
        <nav aria-label={t.links}>
          <div className={col}>{t.links}</div>
          <ul className="space-y-2.5 text-sm text-white/70">
            <li><Link href="/clinics" className={link}>{t.nav.clinics}</Link></li>
            <li><Link href="/doctors" className={link}>{t.nav.doctors}</Link></li>
            <li><Link href="/#insurance" className={link}>{t.nav.insurance}</Link></li>
            <li><Link href="/careers" className={link}>{t.nav.careers}</Link></li>
          </ul>
        </nav>
        <nav aria-label={t.forPatients}>
          <div className={col}>{t.forPatients}</div>
          <ul className="space-y-2.5 text-sm text-white/70">
            <li><Link href="/book" className={link}>{t.nav.book}</Link></li>
            <li><Link href={portalHref} className={link}>{c.loggedIn ? t.nav.myPortal : t.nav.portal}</Link></li>
            {!c.loggedIn && <li><Link href="/register" className={link}>{t.nav.register}</Link></li>}
            <li><Link href="/verify" className={link}>{t.verify}</Link></li>
            {!c.loggedIn && <li><Link href="/login?portal=staff" className={link}>{t.staff}</Link></li>}
          </ul>
        </nav>
        <div>
          <div className={col}>{t.nav.contact}</div>
          <ul className="space-y-3 text-sm text-white/70">
            {s.support_phone && <li><a href={`tel:${s.support_phone}`} className={`flex items-center gap-2 ${link}`}><Phone className="h-4 w-4 text-accent" /><span dir="ltr">{s.support_phone}</span></a></li>}
            {s.whatsapp && <li><a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noreferrer" className={`flex items-center gap-2 ${link}`}><MessageCircle className="h-4 w-4 text-accent" /><span dir="ltr">+{s.whatsapp}</span></a></li>}
            {s.support_email && <li><a href={`mailto:${s.support_email}`} className={`flex items-center gap-2 ${link}`}><Mail className="h-4 w-4 text-accent" /><span dir="ltr">{s.support_email}</span></a></li>}
            <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{ar ? s.address_ar : s.address_en}</li>
            <li className="flex items-start gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{ar ? s.working_hours_ar : s.working_hours_en}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-5 py-5 text-xs text-white/45 sm:px-8">
          <span>© {new Date().getFullYear()} {name}. {t.rights}</span>
          <span className="flex gap-4">
            <Link href="/privacy" className="hover:text-white">{ar ? 'سياسة الخصوصية' : 'Privacy policy'}</Link>
            <Link href="/terms" className="hover:text-white">{ar ? 'الشروط والأحكام' : 'Terms'}</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
