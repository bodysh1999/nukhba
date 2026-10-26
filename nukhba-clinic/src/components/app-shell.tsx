import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Bell, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, getSettings } from '@/lib/session';
import type { Profile } from '@/lib/types';
import { BrandMark } from './brand';
import { LiveRefresh } from './live';
import { BottomNav, Sidebar, type NavItem } from './shell-nav';

export async function AppShell({ profile, children, gates = true }: { profile: Profile; children: React.ReactNode; gates?: boolean }) {
  const [{ d, locale }, s, supabase] = await Promise.all([getI18n(), getSettings(), createClient()]);

  // PDPL: everyone accepts the current privacy policy once; policy may require two-step login for admins & HR
  if (gates) {
    if ((profile.privacy_accepted_version ?? '') !== (s.privacy_version ?? '1.0')) redirect('/account/consent');
    if (s.require_staff_mfa && (profile.role === 'admin' || profile.role === 'hr')) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel !== 'aal2') redirect('/account/security?required=1');
    }
  }
  const { count: unread } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);

  const n = d.nav;
  const role = profile.role;
  let items: NavItem[] = [];
  let bottom: NavItem[] | null = null;

  const bell: NavItem = { href: '/notifications', label: n.notifications, icon: 'bell', badge: unread ?? 0 };
  const site: NavItem = { href: '/', label: n.website, icon: 'website', exact: true };

  // ---------------------------------------------------------------- sections
  const deskItems = async (): Promise<NavItem[]> => {
    const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
    const [{ count: waiting }, { count: reqs }] = await Promise.all([
      supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'checked_in')
        .gte('starts_at', `${today}T00:00:00+03:00`).lte('starts_at', `${today}T23:59:59+03:00`),
      supabase.from('booking_requests').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    ]);
    return [
      { href: '/reception', label: n.reception, icon: 'reception', exact: true, badge: waiting ?? 0, group: n.gDesk },
      { href: '/reception/book', label: n.bookFor, icon: 'book', group: n.gDesk },
      { href: '/reception/appointments', label: n.appointments, icon: 'calendar', group: n.gDesk },
      { href: '/reception/patients', label: n.patients, icon: 'patients', group: n.gDesk },
      { href: '/reception/requests', label: n.requests, icon: 'inbox', badge: reqs ?? 0, group: n.gDesk },
      { href: '/reception/queue', label: n.queue, icon: 'queue', group: n.gDesk },
    ];
  };
  const billingItems = (withReports: boolean): NavItem[] => [
    { href: '/billing', label: n.invoices, icon: 'invoice', exact: true, group: n.gBilling },
    ...(role === 'reception' ? [] : [
      { href: '/billing/claims', label: n.claims, icon: 'claims', group: n.gBilling } as NavItem,
      { href: '/billing/insurers', label: n.insurers, icon: 'insurer', group: n.gBilling } as NavItem,
      { href: '/billing/services', label: n.prices, icon: 'prices', group: n.gBilling } as NavItem,
    ]),
    ...(withReports ? [{ href: '/billing/reports', label: n.reports, icon: 'reports', group: n.gBilling } as NavItem] : []),
  ];
  const hrItems = async (): Promise<NavItem[]> => {
    const { count } = await supabase.from('job_applications').select('id', { count: 'exact', head: true }).eq('status', 'new');
    return [
      { href: '/hr/employees', label: d.hrm.employees, icon: 'employees', group: n.gHr },
      { href: '/hr/requests', label: d.hrm.requests, icon: 'requests', group: n.gHr },
      { href: '/hr/attendance', label: d.hrm.attendance, icon: 'attendance', group: n.gHr },
      { href: '/hr/payroll', label: d.payroll.title, icon: 'payroll', group: n.gHr },
      { href: '/hr/custody', label: d.custody.hrTitle, icon: 'custody', group: n.gHr },
      { href: '/hr/structure', label: d.hrm.structure, icon: 'structure', group: n.gHr },
      { href: '/hr', label: n.applications, icon: 'applications', exact: true, badge: count ?? 0, group: n.gHr },
      { href: '/hr/openings', label: n.openings, icon: 'openings', group: n.gHr },
    ];
  };
  const privacyItem = async (): Promise<NavItem> => {
    const { count } = await supabase.from('data_requests').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']);
    return { href: '/admin/privacy', label: d.privacy.console, icon: 'privacy', badge: count ?? 0, group: n.gAdmin };
  };
  // staff self-service (HR) — every staff role
  const staffMe = async () => {
    const { data: approvals } = await supabase.rpc('my_pending_approvals_count');
    const me: NavItem = { href: '/me', label: n.myServices, icon: 'me', exact: true, group: n.gMe };
    const approvalsItem: NavItem = { href: '/me/approvals', label: n.approvals, icon: 'approvals', badge: Number(approvals ?? 0), group: n.gMe };
    const rest: NavItem[] = [
      { href: '/me/calendar', label: d.hrops.calendar, icon: 'calendarDays', group: n.gMe },
      { href: '/me/custody', label: d.custody.title, icon: 'custody', group: n.gMe },
      { href: '/me/payslips', label: d.payroll.payslips, icon: 'payslip', group: n.gMe },
    ];
    return { me, approvalsItem, rest, all: [me, approvalsItem, ...rest] };
  };

  if (role === 'patient') {
    const p = d.cl.pt.nav;
    items = [
      { href: '/patient', label: p.home, icon: 'home', exact: true },
      { href: '/patient/appointments', label: p.appts, icon: 'calendar' },
      { href: '/patient/book', label: p.book, icon: 'book' },
      { href: '/patient/records', label: p.records, icon: 'records' },
      { href: '/patient/invoices', label: p.invoices, icon: 'invoice' },
      { href: '/patient/profile', label: p.profile, icon: 'me' },
      { ...bell },
    ];
    bottom = items;
  } else if (role === 'doctor') {
    const m = await staffMe();
    items = [
      { href: '/doctor', label: n.myQueue, icon: 'queue', exact: true, group: n.gDoctor },
      { href: '/doctor/patients', label: n.myPatients, icon: 'patients', group: n.gDoctor },
      { href: '/doctor/results', label: n.results, icon: 'lab', group: n.gDoctor },
      { href: '/doctor/schedule', label: n.mySchedule, icon: 'calendar', group: n.gDoctor },
      ...m.all, bell,
    ];
    bottom = [items[0], items[1], items[2], { ...bell, group: n.gMe }, items[3], ...m.all];
  } else if (role === 'reception') {
    const m = await staffMe();
    items = [...(await deskItems()), ...billingItems(false), ...m.all, bell, site];
  } else if (role === 'accountant') {
    const m = await staffMe();
    items = [...billingItems(true), ...m.all, bell, site];
  } else if (role === 'hr') {
    const m = await staffMe();
    items = [...(await hrItems()), ...m.all, bell, site];
  } else if (role === 'employee') {
    const m = await staffMe();
    items = [m.me, { href: '/me/attendance', label: d.me.attendance, icon: 'attendance', group: n.gMe }, m.approvalsItem, { ...bell, group: n.gMe }, ...m.rest];
    bottom = items;
  } else {
    const m = await staffMe();
    items = [
      { href: '/admin', label: n.dashboard, icon: 'dashboard', exact: true },
      ...(await deskItems()),
      { href: '/admin/clinics', label: n.clinics, icon: 'clinic', group: n.gClinic },
      { href: '/admin/doctors', label: n.doctors, icon: 'doctor', group: n.gClinic },
      ...billingItems(true),
      ...(await hrItems()),
      { href: '/admin/team', label: n.team, icon: 'team', group: n.gAdmin },
      await privacyItem(),
      { href: '/admin/system', label: d.system.title, icon: 'analytics', group: n.gAdmin },
      { href: '/admin/settings', label: n.settings, icon: 'settings', group: n.gAdmin },
      ...m.all,
      bell,
    ];
  }

  const canSearch = role === 'admin' || role === 'reception';
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <LiveRefresh userId={profile.id} fallbackSeconds={300} />
      <Sidebar items={items} brand={<BrandMark s={s} locale={locale} light />} user={{ name: profile.full_name || profile.email || '', role: d.roles[profile.role] }} />
      <main className={`min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9 ${bottom ? 'pb-28 lg:pb-9' : ''}`}>
        <div className="no-print mx-auto mb-4 hidden max-w-[1280px] items-center gap-3 lg:flex">
          {canSearch && (
            <form action="/reception/patients" role="search" className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-450" aria-hidden="true" />
              <input type="search" name="q" aria-label={n.search} placeholder={n.search}
                className="h-10 w-full rounded-full border border-sand-200 bg-white ps-10 pe-4 text-sm text-ink placeholder:text-stone-450 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/10" />
            </form>
          )}
          <div className="ms-auto flex items-center gap-2">
            <Link href="/notifications" aria-label={n.notifications} className="relative grid h-10 w-10 place-items-center rounded-full border border-sand-200 bg-white text-ink/70 hover:text-ink">
              <Bell className="h-[18px] w-[18px]" />
              {!!unread && <span className="absolute -end-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">{unread}</span>}
            </Link>
            <Link href="/account" className="flex h-10 items-center gap-2 rounded-full border border-sand-200 bg-white pe-4 ps-1 text-sm text-ink/80 hover:text-ink">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-xs font-semibold text-white">{(profile.full_name || profile.email || '?').replace(/^(د\.|Dr\.)\s*/, '').charAt(0)}</span>
              <span className="max-w-[160px] truncate">{profile.full_name || profile.email}</span>
            </Link>
          </div>
        </div>
        <div className="mx-auto max-w-[1280px]">{children}</div>
      </main>
      {bottom && <BottomNav items={bottom} />}
    </div>
  );
}
