import QRCode from 'qrcode';
import type { CompanySettings } from '@/lib/types';
import { DEFAULT_LOGO } from './brand';
import { PrintButton } from './print-button';

export async function qrSvg(text: string) {
  return QRCode.toString(text, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0B3640', light: '#FFFFFF' } });
}

/** Screen wrapper for an A4 page: print button on screen, scaled preview on phones */
export function PaperScreen({ children, dir = 'rtl' }: { children: React.ReactNode; dir?: 'rtl' | 'ltr' }) {
  return (
    <div dir={dir} className="min-h-screen overflow-x-hidden bg-stone-100 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end px-4 print:hidden"><PrintButton /></div>
      <div className="mx-auto w-fit [zoom:0.43] min-[420px]:[zoom:0.5] min-[520px]:[zoom:0.62] sm:[zoom:0.78] md:[zoom:0.94] lg:[zoom:1] print:[zoom:1]">{children}</div>
    </div>
  );
}

/** A4 letterhead of the medical center */
export function MedicalPaper({ s, title, refNo, children, footer }: { s: CompanySettings; title: string; refNo?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const logo = s.logo_url || DEFAULT_LOGO;
  return (
    <article className="relative mx-auto flex min-h-[297mm] w-[210mm] flex-col overflow-hidden bg-white px-[15mm] py-[12mm] text-[13.5px] leading-[1.9] text-ink shadow-lift print:shadow-none">
      <header className="flex items-center justify-between gap-6 border-b-2 border-[#0E4D5A] pb-4">
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#0E4D5A]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="" className="h-9 w-9 object-contain" />
          </span>
          <div>
            <div className="font-display text-[18px] font-bold text-[#0E4D5A]">{s.name_ar}</div>
            <div className="text-[11.5px] text-stone-500" dir="ltr">{s.name_en}</div>
          </div>
        </div>
        <div className="text-end text-[11px] leading-relaxed text-stone-500">
          {s.moh_license && <div>ترخيص وزارة الصحة: <span dir="ltr">{s.moh_license}</span></div>}
          {s.cr_number && <div>س.ت: <span dir="ltr">{s.cr_number}</span></div>}
          {s.support_phone && <div dir="ltr">{s.support_phone}</div>}
        </div>
      </header>
      <div className="mt-6 flex items-end justify-between">
        <h1 className="font-display text-[22px] font-bold text-[#0E4D5A]">{title}</h1>
        {refNo && <span className="rounded-lg bg-[#F4F8F8] px-3 py-1 font-mono text-[12px]" dir="ltr">{refNo}</span>}
      </div>
      <div className="mt-5 flex-1">{children}</div>
      <footer className="mt-8 border-t border-stone-200 pt-3 text-[11px] text-stone-500">
        {footer}
        <div className="mt-2 flex justify-between"><span>{s.address_ar}</span><span dir="ltr">{s.support_email}</span></div>
      </footer>
    </article>
  );
}
