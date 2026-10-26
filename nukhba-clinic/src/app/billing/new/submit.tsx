'use client';
import { ActionForm, SubmitButton } from '@/components/client';
import { createInvoice } from '@/app/actions/billing';

export function ActionFormButton({ patientId, label }: { patientId: string; label: string }) {
  return (
    <ActionForm action={createInvoice}>
      <input type="hidden" name="patient_id" value={patientId} />
      <SubmitButton size="sm">{label}</SubmitButton>
    </ActionForm>
  );
}
