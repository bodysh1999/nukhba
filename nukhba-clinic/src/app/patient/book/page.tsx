import { getI18n } from '@/lib/session';
import { bookingData } from '@/lib/clinic-data';
import { BookingWizard } from '@/components/booking-wizard';
import { PageHeader } from '@/components/ui';
import { getMyPatient } from '../data';

export const metadata = { title: 'حجز موعد' };

export default async function PatientBook({ searchParams }: { searchParams: Promise<{ doctor?: string; clinic?: string }> }) {
  const sp = await searchParams;
  const [{ d, locale }, data, me] = await Promise.all([getI18n(), bookingData(), getMyPatient()]);
  const ins = me?.insurance_companies && (!me.insurance_expiry || me.insurance_expiry >= new Date().toISOString().slice(0, 10))
    ? (locale === 'ar' ? me.insurance_companies.name_ar : me.insurance_companies.name_en ?? me.insurance_companies.name_ar) : null;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={d.cl.book.title} subtitle={d.cl.book.sub} />
      <BookingWizard data={data} mode="patient" insuranceName={ins} initialDoctor={sp.doctor ?? null} initialClinic={sp.clinic ?? null} />
    </div>
  );
}
