import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarCheck2, CalendarDays, FileBadge, FileHeart, Fingerprint, MessageCircle, Phone, ShieldPlus } from 'lucide-react';
import { getCurrentProfile, getI18n, getSettings, homeFor } from '@/lib/session';
import { DEFAULT_LOGO } from '@/components/brand';
import { LocaleToggle } from '@/components/locale-toggle';
import { Alert } from '@/components/ui';
import { LoginForm } from './login-form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ disabled?: string; portal?: string; next?: string }> }) {
  const profile = await getCurrentProfile();
  if (profile?.is_active) redirect(homeFor(profile.role));
  const [{ d, locale }, s, sp] = await Promise.all([getI18n(), getSettings(), searchParams]);
  const ar = locale === 'ar';
  const name = ar ? s.name_ar : s.name_en;
  const logo = s.logo_url || DEFAULT_LOGO;
  const staff = sp.portal === 'staff';
  const features = staff
    ? (ar
      ? [[Fingerprint, 'الحضور والانصراف', 'بصمة من جوالك داخل المجمع'], [CalendarDays, 'إجازاتك ورصيدك', 'اطلب إجازة واعرف رصيدك المتاح'], [FileBadge, 'طلباتك الوظيفية', 'تعريف راتب، خارج دوام، عهد وأكثر']]
      : [[Fingerprint, 'Attendance', 'check in from your phone at the center'], [CalendarDays, 'Leave & balance', 'request leave and see your balance'], [FileBadge, 'HR requests', 'salary letters, overtime, custody and more']])
    : ar
    ? [[CalendarCheck2, 'احجز في دقيقة', 'اختر الطبيب والوقت ويصلك التأكيد فورًا'], [FileHeart, 'ملفك الطبي معك', 'الوصفات ونتائج التحاليل والإجازات المرضية'], [ShieldPlus, 'تأمينك مباشر', 'تدفع نسبة التحمل فقط عند الاستقبال']]
    : [[CalendarCheck2, 'Book in a minute', 'pick the doctor and time, confirmed instantly'], [FileHeart, 'Your record with you', 'prescriptions, results and sick-leave notes'], [ShieldPlus, 'Direct insurance', 'pay only your co-pay at reception']];

  return (
    <div className="grid min-h-screen bg-sand-50 lg:grid-cols-[1.1fr_1fr]">
      <section className="relative isolate overflow-hidden bg-brand text-white lg:min-h-screen">
        <div className="texture-lines absolute inset-0 -z-10 opacity-70" />
        <div className="absolute -end-32 -top-32 -z-10 h-96 w-96 rounded-full bg-accent/25 blur-3xl" />
        <div className="absolute -bottom-40 -start-24 -z-10 h-[28rem] w-[28rem] rounded-full bg-white/[.06] blur-2xl" />
        <div className="flex h-full flex-col px-6 pb-16 pt-6 sm:px-10 lg:p-12">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15 lg:h-14 lg:w-14">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo} alt={name} className="h-8 w-8 object-contain lg:h-9 lg:w-9" />
              </span>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-semibold lg:text-base">{name}</div>
                <div className="truncate text-[11px] text-white/60">{ar ? s.tagline_ar : s.tagline_en}</div>
              </div>
            </Link>
            <LocaleToggle light className="shrink-0 lg:hidden" />
          </div>
          <div className="mt-8 max-w-lg lg:mt-auto">
            <div className="rise-in mb-5 hidden h-px w-16 bg-accent lg:block" />
            <h2 className="rise-in text-[26px] font-bold leading-[1.45] sm:text-3xl lg:text-[42px] lg:leading-[1.35]">
              {staff
                ? (ar ? <>بوابة الطاقم الطبي<br className="hidden lg:block" /> والموظفين.</> : <>The medical team<br className="hidden lg:block" /> & staff portal.</>)
                : ar ? <>صحتك أولًا،<br className="hidden lg:block" /> وكل زيارة في مكانها.</> : <>Your health first,<br className="hidden lg:block" /> every visit in one place.</>}
            </h2>
            <p className="rise-in-2 mt-3 max-w-md text-sm leading-relaxed text-white/75 lg:mt-5 lg:text-base">{staff ? d.auth.staffSubtitle : d.auth.subtitle}</p>
            <ul className="rise-in-3 mt-10 hidden space-y-4 lg:block">
              {features.map(([Icon, t, sub]) => {
                const I = Icon as typeof Phone;
                return (
                  <li key={t as string} className="flex items-center gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-accent ring-1 ring-white/15 backdrop-blur"><I className="h-5 w-5" /></span>
                    <span><span className="block font-medium">{t as string}</span><span className="text-sm text-white/60">{sub as string}</span></span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      <section className="relative flex min-w-0 flex-col px-4 pb-8 sm:px-10 lg:px-14 lg:py-8">
        <div className="hidden items-center justify-between lg:flex"><Link href="/" className="text-sm text-stone-450 hover:text-brand">{ar ? '→ العودة للموقع' : '← Back to website'}</Link><LocaleToggle /></div>
        <div className="-mt-10 flex flex-1 flex-col justify-center lg:mt-0">
          <div className="rise-in mx-auto w-full max-w-md rounded-[28px] border border-sand-200 bg-white p-6 shadow-lift sm:p-9 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            <div role="tablist" className="mb-6 grid grid-cols-2 rounded-full bg-sand-100 p-1 text-sm">
              <Link href="/login" role="tab" aria-selected={!staff} className={!staff ? 'rounded-full bg-white py-2 text-center font-semibold text-brand shadow-sm' : 'py-2 text-center text-ink/60 hover:text-ink'}>{d.auth.ownersTab}</Link>
              <Link href="/login?portal=staff" role="tab" aria-selected={staff} className={staff ? 'rounded-full bg-white py-2 text-center font-semibold text-brand shadow-sm' : 'py-2 text-center text-ink/60 hover:text-ink'}>{d.auth.staffTab}</Link>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{staff ? d.auth.staffTitle : ar ? 'أهلًا بك' : 'Welcome back'}</h1>
            <p className="mt-1.5 text-sm text-stone-450">{staff ? d.auth.staffSubtitle : d.auth.subtitle}</p>
            {sp.disabled && <Alert tone="error" className="mt-5">{d.auth.disabled}</Alert>}
            <div className="mt-7"><LoginForm next={sp.next?.startsWith('/') ? sp.next : undefined} /></div>
            <div className="mt-8 rounded-2xl bg-sand-100/70 p-4">
              {staff ? <p className="text-xs leading-relaxed text-stone-450">{d.auth.staffNoAccount}</p> : (
                <p className="text-sm text-ink/75">{d.auth.noAccount} <Link href={sp.next ? `/register?next=${encodeURIComponent(sp.next)}` : '/register'} className="font-semibold text-brand hover:underline">{d.auth.register}</Link></p>
              )}
              {(s.support_phone || s.whatsapp) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.whatsapp && (
                    <a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700">
                      <MessageCircle className="h-4 w-4" />{ar ? 'واتساب' : 'WhatsApp'}
                    </a>
                  )}
                  {s.support_phone && (
                    <a href={`tel:${s.support_phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-sand-300 bg-white px-3 text-xs font-medium text-ink hover:bg-sand-50">
                      <Phone className="h-4 w-4" /><span dir="ltr">{s.support_phone}</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="mt-8 text-center text-[11px] text-stone-400">
          © {new Date().getFullYear()} {name} · <Link href="/privacy" className="hover:text-brand">{ar ? 'سياسة الخصوصية' : 'Privacy policy'}</Link> · <Link href="/terms" className="hover:text-brand">{ar ? 'الشروط والأحكام' : 'Terms'}</Link>
        </p>
      </section>
    </div>
  );
}
