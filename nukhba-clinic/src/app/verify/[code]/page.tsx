import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { anonClient } from '@/lib/public-data';
import { siteOrigin } from '@/lib/origin';
import { getSettings } from '@/lib/session';
import { HrLetter, LetterScale, type LetterData } from '@/components/hr-letter';
import { DEFAULT_LOGO } from '@/components/brand';
import { PrintButton } from '@/components/print-button';

export const metadata: Metadata = { title: 'التحقق من وثيقة', robots: { index: false, follow: false } };

type HrVerified = { ref_no: string; type: 'salary_certificate' | 'experience_letter'; addressed_to: string | null; issued_at: string; data: LetterData };
type MedVerified = {
  ref_no: string; kind: 'sick_leave' | 'medical_report' | 'referral'; issued_at: string; revoked: boolean; from_date: string | null; to_date: string | null;
  days: number | null; patient: string; national_id: string | null; doctor: string; clinic: string; center: string;
};
const KIND = { sick_leave: 'إجازة مرضية', medical_report: 'تقرير طبي', referral: 'خطاب تحويل' } as const;
const date = (v: string) => new Date(v).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' });

/** Public page opened from the QR code on a sick leave, medical report or HR letter */
export default async function VerifyDocument({ params }: { params: Promise<{ code: string }> }) {
  const [{ code: raw }, origin, s] = await Promise.all([params, siteOrigin(), getSettings()]);
  const code = decodeURIComponent(raw).replace(/[\s-]/g, '').toLowerCase();
  let med: MedVerified | null = null;
  let hr: HrVerified | null = null;
  if (/^[0-9a-f]{32}$/i.test(code)) {
    const sb = anonClient();
    med = ((await sb.rpc('verify_medical_document', { p_code: code })).data as MedVerified | null) ?? null;
    if (!med) hr = ((await sb.rpc('verify_hr_document', { p_code: code })).data as HrVerified | null) ?? null;
  }

  return (
    <div dir="rtl" className="min-h-screen overflow-x-hidden bg-[#F4F8F8] pb-12 print:bg-white print:pb-0">
      <header className="bg-[#0B3640] text-white print:hidden">
        <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.logo_url || DEFAULT_LOGO} alt="" className="h-6 w-6" />
            </span>
            <span className="text-sm text-white/85">{s.name_ar}</span>
          </Link>
          <span className="shrink-0 text-xs text-white/60">منصة التحقق</span>
        </div>
      </header>

      <div className="mx-auto max-w-[210mm] px-4 pt-8 print:hidden">
        {med ? (
          <div className={`rounded-3xl border p-6 ${med.revoked ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <div className="flex items-center gap-4">
              <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white ${med.revoked ? 'bg-rose-600' : 'bg-emerald-600'}`}>
                {med.revoked ? <ShieldX className="h-8 w-8" /> : <BadgeCheck className="h-8 w-8" />}
              </span>
              <div>
                <h1 className={`text-xl font-bold ${med.revoked ? 'text-rose-900' : 'text-emerald-900'}`}>
                  {med.revoked ? 'هذا المستند ملغى' : `مستند صحيح وصادر من ${med.center}`}
                </h1>
                <p className="mt-1 text-sm text-stone-600">{KIND[med.kind]} · رقم <span dir="ltr">{med.ref_no}</span></p>
              </div>
            </div>
            <dl className="mt-6 grid gap-3 rounded-2xl bg-white p-5 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-stone-500">المريض</dt><dd className="font-semibold">{med.patient}</dd></div>
              {med.national_id && <div><dt className="text-xs text-stone-500">رقم الهوية</dt><dd className="font-mono" dir="ltr">{med.national_id}</dd></div>}
              <div><dt className="text-xs text-stone-500">الطبيب</dt><dd>{med.doctor}</dd></div>
              <div><dt className="text-xs text-stone-500">العيادة</dt><dd>{med.clinic}</dd></div>
              <div><dt className="text-xs text-stone-500">تاريخ الإصدار</dt><dd>{date(med.issued_at)}</dd></div>
              {med.kind === 'sick_leave' && med.from_date && med.to_date && (
                <div><dt className="text-xs text-stone-500">مدة الإجازة</dt><dd className="font-semibold">{med.days} أيام · {date(med.from_date)} — {date(med.to_date)}</dd></div>
              )}
            </dl>
            <p className="mt-3 text-center text-xs text-stone-500">أُخفي جزء من الاسم ورقم الهوية لحماية خصوصية المريض — طابِق البيانات مع النسخة الورقية.</p>
          </div>
        ) : hr ? (
          <div className="flex flex-col gap-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white"><BadgeCheck className="h-8 w-8" /></span>
              <div className="min-w-0">
                <h1 className="text-lg font-bold leading-snug text-emerald-900 sm:text-xl">وثيقة صحيحة وصادرة من {s.name_ar}</h1>
                <p className="mt-1 text-sm text-emerald-800">{hr.type === 'experience_letter' ? 'شهادة خبرة' : 'تعريف بالراتب'} · رقم <span dir="ltr">{hr.ref_no}</span></p>
                <p className="text-sm text-emerald-800">صدرت بتاريخ {date(hr.issued_at)}</p>
              </div>
            </div>
            <div className="shrink-0"><PrintButton /></div>
          </div>
        ) : (
          <div className="flex items-center gap-4 rounded-3xl border border-rose-200 bg-rose-50 p-6">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-rose-600 text-white"><ShieldAlert className="h-8 w-8" /></span>
            <div>
              <h1 className="text-xl font-bold text-rose-900">لم نتمكن من التحقق من هذا المستند</h1>
              <p className="mt-1 text-sm leading-relaxed text-rose-800">رمز التحقق غير صحيح أو أن المستند غير صادر من المجمع. للاستفسار تواصل معنا{s.support_phone ? <> على <span dir="ltr">{s.support_phone}</span></> : null}.</p>
            </div>
          </div>
        )}
        <div className="mt-4 text-center"><Link href="/verify" className="text-sm text-brand hover:underline">تحقق من مستند آخر</Link></div>
      </div>

      {hr && (
        <div className="mt-6 px-4 print:mt-0 print:px-0">
          <LetterScale>
            <HrLetter type={hr.type} refNo={hr.ref_no} issuedAt={hr.issued_at} addressedTo={hr.addressed_to} data={hr.data} verifyUrl={`${origin}/verify/${code}`} />
          </LetterScale>
        </div>
      )}
    </div>
  );
}
