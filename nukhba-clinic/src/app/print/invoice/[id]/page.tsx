import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/session';
import { MedicalPaper, PaperScreen, qrSvg } from '@/components/medical-paper';
import type { Invoice } from '@/lib/types';

const date = (v: string) => new Date(v).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Riyadh' });
const sar = (n: number | string) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const METHOD: Record<string, string> = { cash: 'نقدًا', mada: 'مدى', card: 'بطاقة ائتمانية', apple_pay: 'Apple Pay', transfer: 'تحويل بنكي' };

/** ZATCA simplified-invoice QR (TLV: seller, VAT no., time, total, VAT), base64 */
function zatcaTlv(fields: string[]) {
  const parts: number[] = [];
  fields.forEach((v, i) => {
    const bytes = Array.from(new TextEncoder().encode(v));
    parts.push(i + 1, bytes.length, ...bytes);
  });
  return Buffer.from(parts).toString('base64');
}

export default async function PrintInvoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [supabase, s] = await Promise.all([createClient(), getSettings()]);
  const { data } = await supabase.from('invoices').select('*, patients(full_name, file_no, national_id, insurance_member_no), insurance_companies(name_ar), invoice_items(*), payments(*)').eq('id', id).maybeSingle();
  if (!data || data.status === 'draft') notFound();
  const inv = data as Invoice & {
    patients: { full_name: string; file_no: string; national_id: string | null; insurance_member_no: string | null } | null;
    insurance_companies: { name_ar: string } | null;
    invoice_items: { id: string; description: string; qty: number; unit_price: number; line_total: number }[];
    payments: { id: string; receipt_no: string; amount: number; method: string; received_at: string; voided_at: string | null }[];
  };
  const qr = await qrSvg(zatcaTlv([s.name_ar, s.vat_number ?? '', new Date(inv.issued_at ?? inv.created_at).toISOString(), sar(inv.total).replace(/,/g, ''), sar(inv.vat_amount).replace(/,/g, '')]));
  const cell = 'border border-stone-300 px-3 py-1.5';
  const line = (k: string, v: string, strong = false) => (
    <div className={`flex justify-between py-1 ${strong ? 'border-t border-stone-300 pt-2 text-[15px] font-bold' : ''}`}><span>{k}</span><span dir="ltr">{v} SAR</span></div>
  );
  return (
    <PaperScreen>
      <MedicalPaper s={s} title={inv.status === 'cancelled' ? 'فاتورة ملغاة' : 'فاتورة ضريبية مبسطة'} refNo={inv.inv_no}
        footer={<div className="flex items-center gap-4">
          <div className="h-[24mm] w-[24mm] shrink-0" dangerouslySetInnerHTML={{ __html: qr }} />
          <div>الرقم الضريبي: <span dir="ltr">{s.vat_number}</span><br />السجل التجاري: <span dir="ltr">{s.cr_number}</span></div>
        </div>}>
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            <tr><td className={`${cell} w-28 bg-[#F4F8F8]`}>المريض</td><td className={cell}>{inv.patients?.full_name}</td><td className={`${cell} w-28 bg-[#F4F8F8]`}>رقم الملف</td><td className={cell} dir="ltr">{inv.patients?.file_no}</td></tr>
            <tr><td className={`${cell} bg-[#F4F8F8]`}>التاريخ</td><td className={cell}>{date(inv.issued_at ?? inv.created_at)}</td><td className={`${cell} bg-[#F4F8F8]`}>جهة الدفع</td><td className={cell}>{inv.payer === 'insurance' ? `تأمين — ${inv.insurance_companies?.name_ar ?? ''}` : 'دفع شخصي'}</td></tr>
            {inv.payer === 'insurance' && <tr><td className={`${cell} bg-[#F4F8F8]`}>رقم العضوية</td><td className={cell} dir="ltr">{inv.patients?.insurance_member_no ?? '—'}</td><td className={`${cell} bg-[#F4F8F8]`}>رقم الموافقة</td><td className={cell} dir="ltr">{inv.approval_no ?? '—'}</td></tr>}
          </tbody>
        </table>
        <table className="mt-5 w-full border-collapse text-[13px]">
          <thead><tr className="bg-[#F4F8F8]"><th className={`${cell} w-8`}>#</th><th className={`${cell} text-start`}>الخدمة</th><th className={cell}>الكمية</th><th className={cell}>السعر</th><th className={cell}>المجموع</th></tr></thead>
          <tbody>
            {inv.invoice_items.map((it, i) => (
              <tr key={it.id}><td className={`${cell} text-center`}>{i + 1}</td><td className={cell}>{it.description}</td><td className={`${cell} text-center`}>{Number(it.qty)}</td><td className={cell} dir="ltr">{sar(it.unit_price)}</td><td className={cell} dir="ltr">{sar(it.line_total)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="mt-5 ms-auto w-80 text-[13px]">
          {line('المجموع', sar(inv.subtotal))}
          {Number(inv.discount) > 0 && line('الخصم', `-${sar(inv.discount)}`)}
          {line(`ضريبة القيمة المضافة ${Number(inv.vat_rate)}%`, sar(inv.vat_amount))}
          {line('الإجمالي شامل الضريبة', sar(inv.total), true)}
          {inv.payer === 'insurance' && <>{line('حصة شركة التأمين', sar(inv.insurance_amount))}{line('حصة المريض', sar(inv.patient_amount))}</>}
          {line('المدفوع', sar(inv.paid_amount))}
          {line('المتبقي على المريض', sar(Number(inv.patient_amount) - Number(inv.paid_amount)), true)}
        </div>
        {inv.payments.filter((p) => !p.voided_at).length > 0 && (
          <div className="mt-6 text-[12px] text-stone-600">
            {inv.payments.filter((p) => !p.voided_at).map((p) => <div key={p.id}>إيصال <span dir="ltr">{p.receipt_no}</span> · {METHOD[p.method] ?? p.method} · <span dir="ltr">{sar(p.amount)}</span> · {date(p.received_at)}</div>)}
          </div>
        )}
        {Number(inv.vat_rate) === 0 && <p className="mt-4 text-[11.5px] text-stone-500">الخدمات الصحية الخاصة المقدمة للمواطنين خاضعة لنسبة صفر% (تتحملها الدولة).</p>}
      </MedicalPaper>
    </PaperScreen>
  );
}
