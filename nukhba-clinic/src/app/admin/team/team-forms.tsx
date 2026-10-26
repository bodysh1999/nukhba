'use client';

import { ActionForm, SubmitButton, useI18n } from '@/components/client';
import { TempPassword } from '@/components/forms-kit';
import { Field, Input, Select } from '@/components/ui';
import { createStaff, toggleStaff } from '@/app/actions/admin';

export function StaffCreateForm() {
  const { d } = useI18n();
  return (
    <ActionForm action={createStaff} resetOnSuccess>
      {(state) => (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label={d.common.name} required><Input name="full_name" required /></Field>
            <Field label={d.common.email} required><Input name="email" type="email" required /></Field>
            <Field label={d.common.phone}><Input name="phone" type="tel" /></Field>
            <Field label={d.cl.adm.role}>
              <Select name="role" defaultValue="reception">
                {(['reception', 'accountant', 'hr', 'employee', 'admin'] as const).map((r) => <option key={r} value={r}>{d.roles[r]}</option>)}
              </Select>
            </Field>
          </div>
          <div className="mt-3"><SubmitButton>{d.cl.adm.addStaff}</SubmitButton></div>
          {state?.data?.password ? <TempPassword email={String(state.data.email)} password={String(state.data.password)} /> : null}
        </>
      )}
    </ActionForm>
  );
}

export function ToggleActive({ id, active }: { id: string; active: boolean }) {
  const { d } = useI18n();
  return (
    <ActionForm action={toggleStaff}>
      <input type="hidden" name="profile_id" value={id} />
      <input type="hidden" name="active" value={String(!active)} />
      <SubmitButton size="sm" variant="ghost" className={active ? 'text-rose-700' : 'text-emerald-700'}>{active ? d.common.inactive : d.common.active}</SubmitButton>
    </ActionForm>
  );
}
