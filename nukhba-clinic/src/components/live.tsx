'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from './client';

/**
 * Refreshes the page the moment something relevant changes (Supabase Realtime; RLS decides what each user receives).
 * `tables` watches whole tables (front desk / doctor boards); a slow poll stays as a safety net if the socket drops.
 */
export function LiveRefresh({ userId, tables = [], appointmentId, fallbackSeconds = 120 }: {
  userId?: string; tables?: string[]; appointmentId?: string; fallbackSeconds?: number;
}) {
  const router = useRouter();
  const key = tables.join(',');
  useEffect(() => {
    const sb = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => router.refresh(), 500); };
    const ch = sb.channel(`live-${userId ?? ''}-${key}-${appointmentId ?? ''}-${Math.random().toString(36).slice(2, 8)}`);
    for (const t of key ? key.split(',') : []) ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, refresh);
    if (appointmentId) ch.on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `id=eq.${appointmentId}` }, refresh);
    if (userId) ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, refresh);
    ch.subscribe();
    const poll = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, fallbackSeconds * 1000);
    return () => { clearInterval(poll); if (timer) clearTimeout(timer); sb.removeChannel(ch); };
  }, [userId, key, appointmentId, fallbackSeconds, router]);
  return null;
}

/** Full-screen viewer for an image or PDF (lab results, scanned reports) */
export function DocPreview({ url, title, mime }: { url: string; title: string; mime: string | null }) {
  const { d } = useI18n();
  const [open, setOpen] = useState(false);
  const isImg = !!mime?.startsWith('image/') || /\.(png|jpe?g|webp)(\?|$)/i.test(url);
  const isPdf = mime === 'application/pdf' || /\.pdf(\?|$)/i.test(url);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [open]);
  if (!isImg && !isPdf) return <a href={url} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand hover:underline">{d.cl.rec.downloadFile}</a>;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand px-3 text-xs font-medium text-white hover:bg-brand/90">
        <Eye className="h-3.5 w-3.5" />{d.cl.rec.downloadFile}
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex flex-col bg-ink/80 p-2 backdrop-blur-sm sm:p-6" onClick={() => setOpen(false)}>
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 pb-2 text-white" onClick={(e) => e.stopPropagation()}>
            <span className="truncate text-sm font-medium">{title}</span>
            <button type="button" aria-label="close" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full bg-white/15 hover:bg-white/25"><X className="h-4 w-4" /></button>
          </div>
          <div className="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-hidden rounded-xl bg-white" onClick={(e) => e.stopPropagation()}>
            {isImg
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={url} alt={title} className="h-full w-full object-contain" />
              : <iframe src={url} title={title} className="h-full w-full" />}
          </div>
        </div>
      )}
    </>
  );
}
