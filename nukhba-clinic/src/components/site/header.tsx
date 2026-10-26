'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BadgeCheck, CalendarPlus, ChevronDown, KeyRound, Mail, MapPin, Menu, Phone, UserRound, X } from 'lucide-react';
import { LocaleToggle } from '../locale-toggle';
import { cx } from '../ui';

export type SiteNav = { home: string; clinics: string; doctors: string; insurance: string; careers: string; contact: string; book: string; portal: string; myPortal: string; register: string };
export type HeaderContact = { phone: string | null; email: string | null; address: string | null };

export function SiteHeader({ nav, staffLabel, verifyLabel, logo, name, tagline, portalHref, loggedIn, isPatient, contact, solidAlways = false }: {
  nav: SiteNav; staffLabel: string; verifyLabel: string; logo: string; name: string; tagline: string; portalHref: string; loggedIn: boolean; isPatient: boolean;
  contact: HeaderContact; solidAlways?: boolean;
}) {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 30);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const links = [
    { href: '/', label: nav.home, active: path === '/' },
    { href: '/clinics', label: nav.clinics, active: path.startsWith('/clinics') },
    { href: '/doctors', label: nav.doctors, active: path.startsWith('/doctors') },
    { href: '/#insurance', label: nav.insurance, active: false },
    { href: '/careers', label: nav.careers, active: path.startsWith('/careers') },
    { href: '/#contact', label: nav.contact, active: false },
  ];
  const solid = solidAlways || scrolled || open;
  const bookHref = loggedIn && isPatient ? '/patient/book' : '/book';

  return (
    <header className={cx('fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow] duration-300',
      solid ? 'bg-[#0B3640]/[.97] shadow-[0_8px_30px_-12px_rgba(0,0,0,.45)] backdrop-blur-md' : 'bg-gradient-to-b from-[#06262D]/70 to-transparent')}>
      <div className={cx('hidden overflow-hidden border-b border-white/10 text-[13px] text-white/65 transition-[max-height,opacity] duration-300 md:block',
        scrolled ? 'max-h-0 border-transparent opacity-0' : 'max-h-10 opacity-100')}>
        <div className="mx-auto flex h-10 max-w-7xl items-center gap-6 px-5 sm:px-8">
          {contact.phone && <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1.5 hover:text-white"><Phone className="h-3.5 w-3.5 text-accent" /><span dir="ltr">{contact.phone}</span></a>}
          {contact.email && <a href={`mailto:${contact.email}`} className="hidden items-center gap-1.5 hover:text-white lg:inline-flex"><Mail className="h-3.5 w-3.5 text-accent" /><span dir="ltr">{contact.email}</span></a>}
          {contact.address && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-accent" />{contact.address}</span>}
          <div className="ms-auto flex items-center gap-4">
            <Link href="/verify" className="hover:text-white">{verifyLabel}</Link>
            <span className="h-4 w-px bg-white/15" />
            <LocaleToggle light className="h-8 px-2 text-[13px]" />
          </div>
        </div>
      </div>

      <div className={cx('mx-auto flex max-w-7xl items-center gap-6 px-5 transition-[height] duration-300 sm:px-8', scrolled ? 'h-[68px]' : 'h-[76px]')}>
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label={name}>
          <span className={cx('grid place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15 transition-all', scrolled ? 'h-10 w-10' : 'h-11 w-11')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="" className="h-7 w-7 object-contain" />
          </span>
          <span className="hidden leading-tight text-white sm:block">
            <span className="block font-display text-[15px] font-bold">{name}</span>
            <span className="block text-[11px] text-white/60">{tagline}</span>
          </span>
        </Link>
        <nav aria-label="main" className="hidden flex-1 items-center justify-center gap-1 xl:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={l.active ? 'page' : undefined}
              className={cx('relative rounded-full px-3.5 py-2 text-[15px] transition',
                l.active ? 'text-white' : 'text-white/70 hover:text-white',
                'after:absolute after:inset-x-3.5 after:-bottom-0.5 after:h-[2px] after:rounded-full after:bg-accent after:transition-transform',
                l.active ? 'after:scale-x-100' : 'after:scale-x-0 hover:after:scale-x-100')}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-2 xl:ms-0">
          <Link href={bookHref} className="hidden h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-white shadow-lift transition hover:bg-accent/90 md:inline-flex">
            <CalendarPlus className="h-4 w-4" />{nav.book}
          </Link>
          <Link href={portalHref} className="hidden h-11 items-center gap-2 rounded-full border border-white/25 px-4 text-sm font-medium text-white transition hover:border-white/60 hover:bg-white/10 sm:inline-flex">
            {loggedIn ? <UserRound className="h-4 w-4 text-accent" /> : <KeyRound className="h-4 w-4 text-accent" />}{loggedIn ? nav.myPortal : nav.portal}
          </Link>
          <button aria-label="menu" aria-expanded={open} onClick={() => setOpen(!open)} className="grid h-11 w-11 place-items-center rounded-full text-white hover:bg-white/10 xl:hidden">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="h-[calc(100svh-76px)] overflow-y-auto border-t border-white/10 px-5 pb-10 pt-2 xl:hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className={cx('flex items-center justify-between border-b border-white/[.07] py-4 text-lg', l.active ? 'text-accent' : 'text-white/85')}>
              {l.label}<ChevronDown className="h-4 w-4 -rotate-90 opacity-40 rtl:rotate-90" />
            </Link>
          ))}
          <div className="mt-6 grid gap-3">
            <Link href={bookHref} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent font-semibold text-white"><CalendarPlus className="h-4 w-4" />{nav.book}</Link>
            <Link href={portalHref} className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/25 font-medium text-white"><KeyRound className="h-4 w-4 text-accent" />{loggedIn ? nav.myPortal : nav.portal}</Link>
            {!loggedIn && <Link href="/register" className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/25 font-medium text-white"><UserRound className="h-4 w-4 text-accent" />{nav.register}</Link>}
            {!loggedIn && <Link href="/login?portal=staff" className="inline-flex h-12 items-center justify-center gap-2 rounded-full text-sm text-white/70"><BadgeCheck className="h-4 w-4 text-accent" />{staffLabel}</Link>}
          </div>
          <div className="mt-8 space-y-3 text-sm text-white/60">
            {contact.phone && <a href={`tel:${contact.phone}`} className="flex items-center gap-2"><Phone className="h-4 w-4 text-accent" /><span dir="ltr">{contact.phone}</span></a>}
            {contact.email && <a href={`mailto:${contact.email}`} className="flex items-center gap-2"><Mail className="h-4 w-4 text-accent" /><span dir="ltr">{contact.email}</span></a>}
            <div className="pt-2"><LocaleToggle light /></div>
          </div>
        </div>
      )}
    </header>
  );
}
