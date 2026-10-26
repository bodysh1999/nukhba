import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/session';
import { ageOf } from '@/lib/constants';
import { MedicalPaper, PaperScreen } from '@/components/medical-paper';
import type { Patient, RxItem, TestOrder, Visit } from '@/lib/types';

const date = (v: string) => new Date(v).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' });

/** Visit summary + prescription (patient copy) */
export default async function PrintVisit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [supabase, s] = await Promise.all([createClient(), getSettings()]);
  const { data: v } = await supabase.from('visits').select('*, doctors(full_name_ar, full_name_en, title, scfhs_no), clinics(name_ar, name_en)').eq('id', id).maybeSingle();
  if (!v || v.status !== 'signed') notFound();
  const visit = v as Visit & { doctors: { full_name_ar: string; full_name_en: string | null; scfhs_no: string | null } | null; clinics: { name_ar: string } | null };
  const [{ data: p }, { data: rx }, { data: tests }] = await Promise.all([
    supabase.from('patients').select('*').eq('id', visit.patient_id).single(),
    supabase.from('prescription_items').select('*').eq('visit_id', id).order('created_at'),
    supabase.from('lab_orders').select('*').eq('visit_id', id).neq('status', 'cancelled'),
  ]);
  const pt = p as Patient;
  const cell = 'border border-stone-300 px-3 py-1.5';
  return (
    <PaperScreen>
      <MedicalPaper s={s} title="ملخص الزيارة والوصفة الطبية" refNo={pt.file_no}
        footer={<div>هذه الوصفة صادرة إلكترونيًا من نظام {s.name_ar} وصالحة للصرف خلال 7 أيام من تاريخها.</div>}>
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            <tr><td className={`${cell} w-28 bg-[#F4F8F8]`}>المريض</td><td className={cell}>{pt.full_name}</td><td className={`${cell} w-28 bg-[#F4F8F8]`}>رقم الملف</td><td className={cell} dir="ltr">{pt.file_no}</td></tr>
            <tr><td className={`${cell} bg-[#F4F8F8]`}>العمر / الجنس</td><td className={cell}>{ageOf(pt.birth_date) ?? '—'} سنة · {pt.gender === 'female' ? 'أنثى' : 'ذكر'}</td><td className={`${cell} bg-[#F4F8F8]`}>التاريخ</td><td className={cell}>{date(visit.created_at)}</td></tr>
            <tr><td className={`${cell} bg-[#F4F8F8]`}>الطبيب</td><td className={cell}>{visit.doctors?.full_name_ar}</td><td className={`${cell} bg-[#F4F8F8]`}>العيادة</td><td className={cell}>{visit.clinics?.name_ar}</td></tr>
            {pt.allergies && <tr><td className={`${cell} bg-rose-50 text-rose-800`}>الحساسية</td><td className={`${cell} font-bold text-rose-800`} colSpan={3}>{pt.allergies}</td></tr>}
          </tbody>
        </table>

        <h2 className="mt-6 font-bold text-[#0E4D5A]">التشخيص</h2>
        <p>{visit.diagnosis} {visit.icd10_code && <span className="font-mono text-stone-500" dir="ltr">({visit.icd10_code})</span>}</p>

        <h2 className="mt-5 font-bold text-[#0E4D5A]">℞ الوصفة الطبية</h2>
        {(rx as RxItem[] | null)?.length ? (
          <table className="mt-2 w-full border-collapse text-[13px]">
            <thead><tr className="bg-[#F4F8F8]"><th className={`${cell} w-8`}>#</th><th className={`${cell} text-start`}>الدواء</th><th className={cell}>الجرعة</th><th className={cell}>التكرار</th><th className={cell}>المدة</th></tr></thead>
            <tbody>
              {(rx as RxItem[]).map((x, i) => (
                <tr key={x.id}>
                  <td className={`${cell} text-center`}>{i + 1}</td>
                  <td className={cell}><div className="font-semibold" dir="ltr" style={{ textAlign: 'right' }}>{x.drug_name}</div>{x.instructions && <div className="text-[11.5px] text-stone-500">{x.instructions}</div>}</td>
                  <td className={cell}>{x.dose ?? '—'}</td><td className={cell}>{x.frequency ?? '—'}</td><td className={cell}>{x.duration ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-stone-500">—</p>}

        {(tests as TestOrder[] | null)?.length ? (<>
          <h2 className="mt-5 font-bold text-[#0E4D5A]">الفحوصات المطلوبة</h2>
          <ul className="list-disc ps-5">{(tests as TestOrder[]).map((t) => <li key={t.id}>{t.test_name}{t.result_text ? ` — ${t.result_text}` : ''}</li>)}</ul>
        </>) : null}

        {visit.patient_advice && (<>
          <h2 className="mt-5 font-bold text-[#0E4D5A]">تعليمات الطبيب</h2>
          <p className="whitespace-pre-line">{visit.patient_advice}</p>
        </>)}
        {visit.follow_up_in_days && <p className="mt-4 rounded-lg bg-[#F4F8F8] px-3 py-2">المراجعة بعد {visit.follow_up_in_days} يومًا</p>}

        <div className="mt-10 flex justify-end">
          <div className="w-64 border-t border-stone-400 pt-2 text-center text-[12px]">
            <div className="font-semibold">{visit.doctors?.full_name_ar}</div>
            {visit.doctors?.scfhs_no && <div className="text-stone-500">رقم التصنيف: <span dir="ltr">{visit.doctors.scfhs_no}</span></div>}
            <div className="text-stone-500">توقيع إلكتروني · {date(visit.signed_at ?? visit.created_at)}</div>
          </div>
        </div>
      </MedicalPaper>
    </PaperScreen>
  );
}
