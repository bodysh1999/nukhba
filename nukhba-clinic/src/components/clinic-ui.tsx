import {
  Activity, Baby, Bone, Brain, Ear, Eye, Flower2, HeartPulse, Microscope, Pill, Smile, Sparkles, Star, Stethoscope, Syringe,
} from 'lucide-react';
import type { Dict } from '@/lib/i18n';
import { APPT_TONE, CLAIM_TONE, FLAG_TONE, INVOICE_TONE, ageOf } from '@/lib/constants';
import { fmtMoney } from '@/lib/format';
import type { AppointmentStatus, ClaimStatus, DoctorTitle, InvoiceStatus, Locale, TestFlag } from '@/lib/types';
import { Badge, cx } from './ui';

export const CLINIC_ICONS = {
  stethoscope: Stethoscope, 'heart-pulse': HeartPulse, baby: Baby, flower: Flower2, smile: Smile, sparkles: Sparkles, bone: Bone, eye: Eye,
  brain: Brain, ear: Ear, pill: Pill, activity: Activity, syringe: Syringe, microscope: Microscope,
} as const;
export type ClinicIconKey = keyof typeof CLINIC_ICONS;

export function ClinicIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  const Icon = CLINIC_ICONS[(name ?? 'stethoscope') as ClinicIconKey] ?? Stethoscope;
  return <Icon className={className} strokeWidth={1.6} />;
}

export function ApptBadge({ status, d }: { status: AppointmentStatus; d: Dict }) {
  return <Badge className={APPT_TONE[status]}>{d.cl.status[status]}</Badge>;
}
export function InvoiceBadge({ status, d }: { status: InvoiceStatus; d: Dict }) {
  return <Badge className={INVOICE_TONE[status]}>{d.cl.invs[status]}</Badge>;
}
export function ClaimBadge({ status, d }: { status: ClaimStatus; d: Dict }) {
  return <Badge className={CLAIM_TONE[status]}>{d.cl.claim[status]}</Badge>;
}
export function FlagBadge({ flag, d }: { flag: TestFlag | null; d: Dict }) {
  if (!flag) return null;
  return <Badge className={FLAG_TONE[flag]}>{d.cl.flag[flag]}</Badge>;
}

/** Name initials on a soft tile (no stock photos of real people) */
export function Avatar({ name, gender, photo, size = 'md', className }: {
  name: string; gender?: 'male' | 'female' | null; photo?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string;
}) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-11 w-11 text-sm', lg: 'h-16 w-16 text-lg', xl: 'h-24 w-24 text-2xl' };
  const parts = name.replace(/^(د\.|Dr\.)\s*/, '').split(/\s+/).filter(Boolean);
  const initials = (parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '');
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt={name} className={cx(sizes[size], 'shrink-0 rounded-2xl object-cover', className)} />;
  }
  return (
    <span aria-hidden className={cx(sizes[size], 'grid shrink-0 place-items-center rounded-2xl font-semibold',
      gender === 'female' ? 'bg-accent/15 text-accent' : 'bg-brand/10 text-brand', className)}>
      {initials}
    </span>
  );
}

export function doctorName(doc: { full_name_ar: string; full_name_en?: string | null }, locale: Locale) {
  return locale === 'en' && doc.full_name_en ? doc.full_name_en : doc.full_name_ar;
}
export function clinicName(c: { name_ar: string; name_en?: string | null }, locale: Locale) {
  return locale === 'en' && c.name_en ? c.name_en : c.name_ar;
}
export function titleOf(d: Dict, t: DoctorTitle) {
  return d.cl.title[t];
}

export function Stars({ score, className }: { score: number; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-0.5', className)} aria-label={`${score}/5`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={cx('h-3.5 w-3.5', i <= Math.round(score) ? 'fill-accent text-accent' : 'text-sand-300')} />)}
    </span>
  );
}

export function Money({ v, l, className }: { v: number | string | null | undefined; l: Locale; className?: string }) {
  return <span className={cx('tabular-nums', className)}>{fmtMoney(v, l)}</span>;
}

/** "محمد العتيبي · 38 سنة · ذكر · P100023" */
export function PatientLine({ p, d }: { p: { full_name?: string; patient_name?: string; file_no: string; gender?: string | null; patient_gender?: string | null; birth_date?: string | null; patient_birth_date?: string | null }; d: Dict }) {
  const age = ageOf(p.birth_date ?? p.patient_birth_date ?? null);
  const g = (p.gender ?? p.patient_gender) as 'male' | 'female' | undefined;
  return (
    <span className="text-xs text-stone-450">
      <span dir="ltr">{p.file_no}</span>
      {age !== null && <> · {age} {d.cl.f.years}</>}
      {g && <> · {d.cl.gender[g]}</>}
    </span>
  );
}

/** Riyadh clock time, e.g. 4:20 م */
export function fmtTime(iso: string | null | undefined, l: Locale) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(l === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Riyadh', hour12: true }).format(new Date(iso));
}
export function fmtDay(iso: string | Date, l: Locale, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) {
  return new Intl.DateTimeFormat(l === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { ...opts, timeZone: 'Asia/Riyadh' }).format(typeof iso === 'string' ? new Date(iso) : iso);
}
