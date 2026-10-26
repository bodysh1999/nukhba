import { getI18n } from '@/lib/session';
import { Avatar } from '@/components/clinic-ui';
import { Card, CardHeader, KeyValue, PageHeader } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import { ageOf } from '@/lib/constants';
import { ContactForm } from '../patient-client';
import { getMyPatient } from '../data';

export const metadata = { title: 'ملفي' };

export default async function MyProfile() {
  const [{ d, locale }, me] = await Promise.all([getI18n(), getMyPatient()]);
  if (!me) return null;
  const f = d.cl.f;
  const p = d.cl.profile;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={p.title} />
      <Card className="flex items-center gap-4 p-5">
        <Avatar name={me.full_name} gender={me.gender} size="lg" />
        <div><div className="text-lg font-semibold">{me.full_name}</div><div className="text-sm text-stone-450" dir="ltr">{me.file_no}</div></div>
      </Card>
      <Card>
        <CardHeader title={p.personal} />
        <div className="divide-y divide-sand-100 px-5">
          <KeyValue label={f.nationalId}><span dir="ltr">{me.national_id ?? '—'}</span></KeyValue>
          <KeyValue label={f.birthDate}>{fmtDate(me.birth_date, locale)} {ageOf(me.birth_date) !== null && <span className="text-stone-450">({ageOf(me.birth_date)} {f.years})</span>}</KeyValue>
          <KeyValue label={f.gender}>{d.cl.gender[me.gender]}</KeyValue>
          <KeyValue label={f.nationality}>{me.is_saudi ? f.saudi : me.nationality ?? f.nonSaudi}</KeyValue>
          <KeyValue label={f.insurance}>{me.insurance_companies ? (locale === 'ar' ? me.insurance_companies.name_ar : me.insurance_companies.name_en ?? me.insurance_companies.name_ar) : f.noInsurance}</KeyValue>
        </div>
      </Card>
      <Card>
        <CardHeader title={p.medical} subtitle={p.medicalNote} />
        <div className="divide-y divide-sand-100 px-5">
          <KeyValue label={f.bloodType}>{me.blood_type ?? '—'}</KeyValue>
          <KeyValue label={f.allergies}>{me.allergies ?? '—'}</KeyValue>
          <KeyValue label={f.chronic}>{me.chronic_conditions ?? '—'}</KeyValue>
          <KeyValue label={f.meds}>{me.current_medications ?? '—'}</KeyValue>
        </div>
      </Card>
      <Card>
        <CardHeader title={p.contact} />
        <div className="p-5"><ContactForm p={me} /></div>
      </Card>
    </div>
  );
}
