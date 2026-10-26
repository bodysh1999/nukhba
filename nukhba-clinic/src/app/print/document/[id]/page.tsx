import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/session';
import { siteOrigin } from '@/lib/origin';
import { ageOf } from '@/lib/constants';
import { MedicalPaper, PaperScreen, qrSvg } from '@/components/medical-paper';
import type { MedicalDoc, Patient } from '@/lib/types';

const date = (v: string) => new Date(v).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' });
const hijri = (v: string) => new Date(v).toLocaleDateString('ar-SA-u-nu-latn-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' });
const TITLE = { sick_leave: ['إجازة مرضية', 'Sick Leave Report'], medical_report: ['تقرير طبي', 'Medical Report'], referral: ['خطاب تحويل', 'Referral Letter'] } as const;

/** Sick leave / medical report / referral with a QR anyone can scan to verify */
export default async function PrintDocument({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [supabase, s, origin] = await Promise.all([createClient(), getSettings(), siteOrigin()]);
  const { data: m } = await supabase.from('medical_documents').select('*, doctors(full_name_ar, full_name_en, title, scfhs_no, clinics(name_ar, name_en))').eq('id', id).maybeSingle();
  if (!m) notFound();
  const doc = m as MedicalDoc & { doctors: { full_name_ar: string; full_name_en: string | null; scfhs_no: string | null; clinics: { name_ar: string; name_en: string } | null } | null };
  const { data: p } = await supabase.from('patients').select('*').eq('id', doc.patient_id).single();
  const pt = p as Patient;
  const verifyUrl = `${origin}/verify/${doc.verify_code}`;
  const qr = await qrSvg(verifyUrl);
  const days = doc.from_date && doc.to_date ? Math.round((Date.parse(doc.to_date) - Date.parse(doc.from_date)) / 86400e3) + 1 : null;
  const cell = 'border border-stone-300 px-3 py-2';
  const row = (ar: string, en: string, v: React.ReactNode) => (
    <tr><td className={`${cell} w-44 bg-[#F4F8F8]`}><div>{ar}</div><div className="text-[10.5px] text-stone-500" dir="ltr">{en}</div></td><td className={cell}>{v}</td></tr>
  );
  return (
    <PaperScreen>
      <MedicalPaper s={s} title={TITLE[doc.kind][0]} refNo={doc.ref_no}
        footer={<div className="flex items-center gap-4">
          <div className="h-[24mm] w-[24mm] shrink-0" dangerouslySetInnerHTML={{ __html: qr }} />
          <div>
            <div className="font-semibold text-[#0E4D5A]">للتحقق من صحة المستند امسح الرمز أو زر</div>
            <div dir="ltr">{verifyUrl.replace(/^https?:\/\//, '').replace(/\/verify\/.*$/, '/verify')}</div>
            <div className="font-mono tracking-wide" dir="ltr">{doc.verify_code.match(/.{1,4}/g)?.join(' ')}</div>
          </div>
        </div>}>
        {doc.revoked_at && <div className="mb-4 rounded-lg border-2 border-rose-500 px-4 py-2 text-center font-bold text-rose-600">ملغى — VOID</div>}
        <div className="mb-3 text-[12px] text-stone-500" dir="ltr">{TITLE[doc.kind][1]}</div>
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            {row('اسم المريض', 'Patient name', <>{pt.full_name}{pt.full_name_en && <div className="text-[11.5px] text-stone-500" dir="ltr">{pt.full_name_en}</div>}</>)}
            {row('رقم الهوية / الإقامة', 'ID / Iqama', <span dir="ltr">{pt.national_id ?? '—'}</span>)}
            {row('العمر / الجنس', 'Age / Gender', `${ageOf(pt.birth_date) ?? '—'} · ${pt.gender === 'female' ? 'أنثى' : 'ذكر'}`)}
            {row('رقم الملف', 'File no.', <span dir="ltr">{pt.file_no}</span>)}
            {doc.kind === 'sick_leave' && doc.from_date && doc.to_date && <>
              {row('مدة الإجازة', 'Duration', <b>{days} {days === 1 ? 'يوم' : days === 2 ? 'يومان' : 'أيام'}</b>)}
              {row('من تاريخ', 'From', <>{date(doc.from_date)} <span className="text-stone-500">· {hijri(doc.from_date)}</span></>)}
              {row('إلى تاريخ', 'To', <>{date(doc.to_date)} <span className="text-stone-500">· {hijri(doc.to_date)}</span></>)}
            </>}
            {doc.kind === 'referral' && row('محوّل إلى', 'Referred to', doc.referral_to)}
            {row('العيادة', 'Clinic', doc.doctors?.clinics?.name_ar)}
            {row('تاريخ الإصدار', 'Issue date', date(doc.issued_at))}
          </tbody>
        </table>
        {doc.body && <div className="mt-6"><h2 className="font-bold text-[#0E4D5A]">{doc.kind === 'referral' ? 'سبب التحويل' : 'التقرير'}</h2><p className="mt-1 whitespace-pre-line">{doc.body}</p></div>}
        <div className="mt-12 flex justify-end">
          <div className="w-64 border-t border-stone-400 pt-2 text-center text-[12px]">
            <div className="font-semibold">{doc.doctors?.full_name_ar}</div>
            {doc.doctors?.full_name_en && <div className="text-stone-500" dir="ltr">{doc.doctors.full_name_en}</div>}
            {doc.doctors?.scfhs_no && <div className="text-stone-500">رقم التصنيف: <span dir="ltr">{doc.doctors.scfhs_no}</span></div>}
          </div>
        </div>
      </MedicalPaper>
    </PaperScreen>
  );
}
