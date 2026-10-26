import Link from 'next/link';
import { getI18n } from '@/lib/session';
import { DocumentsList, loadRecord, ResultsList, VisitsTimeline } from '@/components/medical-record';
import { PageHeader, cx } from '@/components/ui';
import { getMyPatient } from '../data';

export const metadata = { title: 'سجلي الطبي' };

export default async function MyRecords({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const [{ d, locale }, me] = await Promise.all([getI18n(), getMyPatient()]);
  if (!me) return null;
  const rec = await loadRecord(me.id);
  const r = d.cl.rec;
  const tab = sp.tab === 'results' || sp.tab === 'docs' ? sp.tab : 'visits';
  const tabs = [['visits', r.visits, rec.visits.length], ['results', r.results, rec.tests.filter((t) => t.status === 'resulted').length], ['docs', r.docs, rec.docs.length]] as const;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={r.records} subtitle={<span dir="ltr">{me.file_no}</span>} />
      <div className="mb-5 grid grid-cols-3 rounded-full bg-sand-100 p-1 text-sm">
        {tabs.map(([k, label, n]) => (
          <Link key={k} href={k === 'visits' ? '/patient/records' : `/patient/records?tab=${k}`} className={cx('truncate rounded-full px-2 py-2 text-center', tab === k ? 'bg-white font-semibold text-brand shadow-sm' : 'text-ink/60')}>
            {label} <span className="text-xs text-stone-450">{n}</span>
          </Link>
        ))}
      </div>
      {tab === 'visits' && <VisitsTimeline data={rec} d={d} locale={locale} audience="patient" />}
      {tab === 'results' && <ResultsList data={rec} d={d} locale={locale} />}
      {tab === 'docs' && <DocumentsList data={rec} d={d} locale={locale} />}
    </div>
  );
}
