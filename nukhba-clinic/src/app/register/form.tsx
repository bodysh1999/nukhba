'use client';

import Link from 'next/link';
import { ActionForm, SubmitButton, useI18n } from '@/components/client';
import { Field, Input, Select } from '@/components/ui';
import { registerPatient } from '@/app/actions/clinic';

export function RegisterForm({ next }: { next?: string }) {
  const { d, locale } = useI18n();
  const f = d.cl.f;
  return (
    <ActionForm action={registerPatient} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Field label={d.common.name} required><Input name="full_name" required autoComplete="name" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={f.nationalId} required><Input name="national_id" inputMode="numeric" maxLength={10} required dir="ltr" placeholder="1xxxxxxxxx" /></Field>
        <Field label={f.phone} required><Input name="phone" type="tel" required autoComplete="tel" placeholder="05xxxxxxxx" /></Field>
        <Field label={f.birthDate} required><Input name="birth_date" type="date" required /></Field>
        <Field label={f.gender}>
          <Select name="gender" defaultValue="male"><option value="male">{d.cl.gender.male}</option><option value="female">{d.cl.gender.female}</option></Select>
        </Field>
        <Field label={f.nationality}>
          <Select name="is_saudi" defaultValue="true"><option value="true">{f.saudi}</option><option value="false">{f.nonSaudi}</option></Select>
        </Field>
        <Field label={f.email} required><Input name="email" type="email" required autoComplete="email" /></Field>
      </div>
      <Field label={d.auth.password} hint={d.cl.site.passwordHint} required><Input name="password" type="password" minLength={8} required autoComplete="new-password" dir="ltr" /></Field>
      <label className="flex items-start gap-2 text-sm text-ink/80">
        <input type="checkbox" name="consent" required className="mt-1 h-4 w-4 rounded border-sand-300 text-brand" />
        <span>{d.privacy.gateAccept} — <Link href="/privacy" target="_blank" className="text-brand underline">{locale === 'ar' ? 'سياسة الخصوصية' : 'Privacy policy'}</Link></span>
      </label>
      <SubmitButton size="lg" variant="accent" className="w-full">{d.cl.site.registerBtn}</SubmitButton>
      <p className="text-center text-sm"><Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="text-brand hover:underline">{d.cl.site.haveAccount}</Link></p>
    </ActionForm>
  );
}
