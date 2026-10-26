import Link from 'next/link';
import { Globe2, KeyRound } from 'lucide-react';
import { getI18n } from '@/lib/session';
import { getClinics, getDoctors } from '@/lib/clinic-data';
import { Creator } from '@/components/forms-kit';
import { Avatar, ClinicIcon } from '@/components/clinic-ui';
import { Badge, Card, PageHeader } from '@/components/ui';
import { DoctorForm } from '../clinic-forms';

export const metadata = { title: 'الأطباء' };

export default async function DoctorsPage() {
  const [{ d, locale }, clinics, doctors] = await Promise.all([getI18n(), getClinics(false), getDoctors(false)]);
  const a = d.cl.adm;
  return (
    <div>
      <PageHeader title={a.doctors} subtitle={`${doctors.filter((x) => x.is_active).length}`} />
      <div className="mb-6"><Creator label={a.addDoctor}>{() => <DoctorForm clinics={clinics} />}</Creator></div>
      <div className="space-y-6">
        {clinics.map((c) => {
          const list = doctors.filter((x) => x.clinic_id === c.id);
          if (!list.length) return null;
          return (
            <section key={c.id}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-450"><ClinicIcon name={c.icon} className="h-4 w-4" />{locale === 'ar' ? c.name_ar : c.name_en}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((x) => (
                  <Link key={x.id} href={`/admin/doctors/${x.id}`}>
                    <Card className={`flex items-center gap-3 p-4 transition hover:border-brand/30 ${x.is_active ? '' : 'opacity-60'}`}>
                      <Avatar name={x.full_name_ar} gender={x.gender} photo={x.photo_url} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{locale === 'ar' ? x.full_name_ar : x.full_name_en ?? x.full_name_ar}</div>
                        <div className="truncate text-xs text-stone-450">{d.cl.title[x.title]} · {x.consultation_fee} {d.common.sar}</div>
                        <div className="mt-1 flex gap-1">
                          {x.profile_id && <Badge className="bg-sky-50 text-sky-800 ring-sky-200"><KeyRound className="h-3 w-3" />{a.hasLogin}</Badge>}
                          {x.accepts_online && <Badge className="bg-emerald-50 text-emerald-800 ring-emerald-200"><Globe2 className="h-3 w-3" />{d.cl.source.online}</Badge>}
                          {!x.is_active && <Badge className="bg-stone-100 text-stone-600 ring-stone-200">{d.common.inactive}</Badge>}
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
