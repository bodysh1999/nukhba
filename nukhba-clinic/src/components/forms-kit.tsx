'use client';

import { useState, type ReactNode } from 'react';
import { Copy, KeyRound, Plus, X } from 'lucide-react';
import { useI18n } from './client';
import { Button } from './ui';

/** Collapsible inline creator panel */
export function Creator({ label, children, variant = 'primary' }: { label: string; children: (close: () => void) => ReactNode; variant?: 'primary' | 'outline' }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button type="button" variant={variant} onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{label}</Button>;
  return (
    <div className="w-full rounded-2xl border border-sand-200 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">{label}</h3>
        <button type="button" aria-label="close" onClick={() => setOpen(false)} className="text-stone-450 hover:text-ink"><X className="h-5 w-5" /></button>
      </div>
      {children(() => setOpen(false))}
    </div>
  );
}

/** Shows a one-time temporary password after creating a login */
export function TempPassword({ email, password }: { email: string; password: string }) {
  const { d } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 rounded-xl border border-accent/40 bg-accent/[.06] p-3 text-sm">
      <div className="flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4 text-accent" />{d.admin.owners.tempPassword}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2" dir="ltr">
        <code className="rounded-lg bg-white px-2 py-1 text-xs">{email}</code>
        <code className="rounded-lg bg-white px-2 py-1 font-semibold">{password}</code>
        <button type="button" onClick={() => { navigator.clipboard.writeText(`${email}\n${password}`); setCopied(true); }} className="text-stone-450 hover:text-ink" aria-label="copy">
          <Copy className="h-4 w-4" />
        </button>
        {copied && <span className="text-xs text-emerald-700">✓</span>}
      </div>
      <p className="mt-2 text-xs text-stone-450">{d.admin.owners.tempPasswordHint}</p>
    </div>
  );
}
