'use client';

import { startTransition, useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertCircle, CheckCircle2, FileText, Loader2, Upload } from 'lucide-react';
import { submitApplication } from '@/app/actions/public';
import { createClient } from '@/lib/supabase/client';
import type { PublicOpening } from '@/lib/public-data';
import type { PagesContent } from '@/lib/site-pages';
import type { ActionResult } from '@/lib/types';
import { cx } from './ui';
import { useKeepOnError } from './client';

// ------------------------------------------------------------------ shared bits
const inputCls = 'block h-12 w-full rounded-xl border border-sand-200 bg-white px-4 text-[15px] text-ink outline-none transition placeholder:text-stone-400 focus:border-brand focus:ring-4 focus:ring-brand/10';
const labelCls = 'mb-1.5 block text-sm font-medium text-ink/80';

function F({ label, children, className, opt, optText }: { label: string; children: ReactNode; className?: string; opt?: boolean; optText?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className={labelCls}>{label}{opt && <span className="ms-1 text-xs font-normal text-stone-450">({optText})</span>}</span>
      {children}
    </label>
  );
}

/** Invisible to people; bots fill it and their submission is silently dropped */
function Honeypot() {
  return (
    <div aria-hidden className="absolute -start-[9999px] h-0 w-0 overflow-hidden">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
  );
}

function Submit({ children, pending: forced, sending }: { children: ReactNode; pending?: boolean; sending: string }) {
  const { pending } = useFormStatus();
  const busy = pending || forced;
  return (
    <button type="submit" disabled={busy}
      className="inline-flex h-13 min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-brand px-8 text-[15px] font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60 sm:w-auto">
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? sending : children}
    </button>
  );
}

/** PDPL: explicit consent for this request (required) + marketing (optional, separate) */
function ConsentBoxes({ f }: { f: PagesContent['form'] }) {
  return (
    <div className="space-y-2.5 text-sm text-ink/80">
      <label className="flex cursor-pointer items-start gap-2.5">
        <input type="checkbox" name="consent_privacy" required className="mt-0.5 h-4 w-4 shrink-0 rounded border-sand-300 text-brand focus:ring-brand" />
        <span>{f.consentPre}<a href="/privacy" target="_blank" rel="noreferrer" className="font-medium text-brand underline underline-offset-2">{f.privacyLink}</a>{f.consentPost}</span>
      </label>
      <label className="flex cursor-pointer items-start gap-2.5">
        <input type="checkbox" name="consent_marketing" className="mt-0.5 h-4 w-4 shrink-0 rounded border-sand-300 text-brand focus:ring-brand" />
        <span>{f.consentMarketing}</span>
      </label>
    </div>
  );
}

function ErrorLine({ state }: { state: ActionResult }) {
  if (!state?.error) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{state.error}
    </p>
  );
}

function Done({ refNo, f, onAgain }: { refNo: string; f: PagesContent['form']; onAgain: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div ref={ref} tabIndex={-1} role="status" className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-8 text-center outline-none">
      <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" strokeWidth={1.6} />
      <h3 className="mt-4 font-display text-2xl font-bold text-ink">{f.done}</h3>
      <p className="mt-3 text-sm text-stone-450">{f.doneRef}</p>
      <p className="font-display text-3xl font-bold tracking-wide text-brand" dir="ltr">{refNo}</p>
      <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-ink/70">{f.doneBody}</p>
      <button type="button" onClick={onAgain} className="mt-6 text-sm font-medium text-brand underline-offset-4 hover:underline">{f.another}</button>
    </div>
  );
}

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });

// ------------------------------------------------------------------ lead form (visit / booking / service / inquiry)
export function ApplicationForm({ openings, pg, initialKind = 'job' }: { openings: PublicOpening[]; pg: PagesContent; initialKind?: 'job' | 'training' }) {
  const c = pg.careers;
  const f = pg.form;
  const [kind, setKind] = useState<'job' | 'training'>(initialKind);
  const [state, action, isPending] = useActionState(submitApplication, undefined);
  const [uploading, setUploading] = useState(false);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [again, setAgain] = useState(0);
  const [hide, setHide] = useState(false);
  useEffect(() => { if (state?.ok) setHide(false); }, [state]);

  // react to "apply for this position" buttons and #training links
  useEffect(() => {
    const on = (e: Event) => {
      const { kind: k, opening } = (e as CustomEvent<{ kind: 'job' | 'training'; opening?: string }>).detail;
      setKind(k);
      setTimeout(() => {
        const sel = document.querySelector<HTMLSelectElement>('#apply select[name="opening_id"]');
        if (sel && opening !== undefined) sel.value = opening;
      }, 0);
    };
    window.addEventListener('ola:apply', on);
    if (window.location.hash === '#training') setKind('training');
    return () => window.removeEventListener('ola:apply', on);
  }, []);

  if (state?.ok && !hide) return <Done refNo={String(state.data?.ref ?? '')} f={f} onAgain={() => { setHide(true); setAgain((n) => n + 1); }} />;

  const jobs = openings.filter((o) => o.employment !== 'training');
  const trainings = openings.filter((o) => o.employment === 'training');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFileErr(null);
    const fd = new FormData(e.currentTarget);
    const file = fd.get('cv') as File | null;
    fd.delete('cv');
    if (file && file.size > 0) {
      const ext = (file.name.split('.').pop() ?? '').toLowerCase();
      if (!['pdf', 'doc', 'docx'].includes(ext) || file.size > 5 * 1024 * 1024) { setFileErr(c.cvError); return; }
      setUploading(true);
      const path = `applications/${crypto.randomUUID()}.${ext}`;
      const { error } = await createClient().storage.from('cvs').upload(path, file, { contentType: file.type || undefined, upsert: false });
      setUploading(false);
      if (error) { setFileErr(c.cvError); return; }
      fd.set('cv_path', path);
    }
    startTransition(() => action(fd));
  }

  return (
    <div>
      <div role="tablist" className="mb-6 inline-flex rounded-full bg-sand-100 p-1">
        {(['job', 'training'] as const).map((k) => (
          <button key={k} role="tab" type="button" aria-selected={kind === k} onClick={() => setKind(k)}
            className={cx('h-10 rounded-full px-6 text-sm font-medium transition', kind === k ? 'bg-white text-brand shadow-sm' : 'text-ink/60 hover:text-ink')}>
            {k === 'job' ? c.tabJob : c.tabTraining}
          </button>
        ))}
      </div>
      <form key={`${kind}-${again}`} onSubmit={onSubmit} className="relative grid gap-4 sm:grid-cols-2">
        <Honeypot />
        <input type="hidden" name="kind" value={kind} />
        <F label={c.position} className="sm:col-span-2">
          <select name="opening_id" className={inputCls} defaultValue="">
            <option value="">{c.general}</option>
            {(kind === 'job' ? jobs : trainings).map((o) => <option key={o.id} value={o.id}>{o.title}{o.department ? ` — ${o.department}` : ''}</option>)}
          </select>
        </F>
        <F label={f.name}><input name="full_name" required minLength={2} autoComplete="name" className={inputCls} /></F>
        <F label={f.phone}><input name="phone" required type="tel" inputMode="tel" dir="ltr" placeholder={f.phoneHint} className={cx(inputCls, 'text-start')} /></F>
        <F label={f.email}><input name="email" required type="email" dir="ltr" autoComplete="email" className={cx(inputCls, 'text-start')} /></F>
        <F label={f.city} opt optText={f.optional}><input name="city" maxLength={60} className={inputCls} /></F>
        <F label={c.education}>
          <select name="education" className={inputCls} defaultValue={kind === 'training' ? c.educationOpts[5] : ''}>
            <option value="">—</option>
            {c.educationOpts.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </F>
        <F label={c.major}><input name="major" maxLength={120} className={inputCls} /></F>
        <F label={c.university} opt optText={f.optional}><input name="university" maxLength={120} className={inputCls} /></F>
        {kind === 'job'
          ? <F label={c.experience}><input name="experience_years" type="number" min={0} max={60} inputMode="numeric" className={inputCls} /></F>
          : <div className="grid grid-cols-2 gap-3">
              <F label={c.from}><input name="training_from" type="date" min={today()} className={inputCls} /></F>
              <F label={c.to}><input name="training_to" type="date" min={today()} className={inputCls} /></F>
            </div>}
        <F label={c.linkedin} opt optText={f.optional} className="sm:col-span-2"><input name="linkedin_url" type="url" dir="ltr" placeholder="https://linkedin.com/in/…" className={cx(inputCls, 'text-start')} /></F>
        <div className="sm:col-span-2">
          <span className={labelCls}>{c.cv}</span>
          <label className="flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed border-sand-300 bg-sand-50 px-5 py-5 transition hover:border-brand/40 focus-within:border-brand">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-brand shadow-sm">{fileName ? <FileText className="h-5 w-5" /> : <Upload className="h-5 w-5" />}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">{fileName || c.cvChoose}</span>
              <span className="block text-xs text-stone-450">{c.cvHint}</span>
            </span>
            <input type="file" name="cv" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')} />
          </label>
        </div>
        <F label={c.note} opt optText={f.optional} className="sm:col-span-2"><textarea name="cover_note" rows={3} maxLength={2000} className={cx(inputCls, 'h-auto py-3')} /></F>
        <div className="space-y-3 sm:col-span-2">
          <ConsentBoxes f={f} />
          {fileErr && <ErrorLine state={{ error: fileErr }} />}
          <ErrorLine state={state} />
          <Submit pending={uploading || isPending} sending={uploading ? c.uploading : f.sending}>{kind === 'job' ? c.apply : c.trainingCta}</Submit>
        </div>
      </form>
    </div>
  );
}

/** Small button that pre-selects a position in the application form */
export function ApplyButton({ kind, opening, children, className }: { kind: 'job' | 'training'; opening?: string; children: ReactNode; className?: string }) {
  return (
    <a href="#apply" className={className}
      onClick={() => window.dispatchEvent(new CustomEvent('ola:apply', { detail: { kind, opening } }))}>
      {children}
    </a>
  );
}
