'use client';

import { useState } from 'react';
import { ActionForm, SubmitButton, useI18n } from '@/components/client';
import { Card, CardHeader, Field, Input } from '@/components/ui';
import { sendTestMessage, updateSettings, uploadLogo } from '@/app/actions/admin';
import type { CompanySettings } from '@/lib/types';
import { DEFAULT_LOGO } from '@/components/brand';

export function SettingsForm({ s, providers }: { s: CompanySettings; providers: Record<'sms' | 'whatsapp' | 'email', string> }) {
  const { d, locale } = useI18n();
  const t = d.cl.adm.settings;
  const [primary, setPrimary] = useState(s.primary_color);
  const [accent, setAccent] = useState(s.accent_color);
  const color = (name: string, v: string, set: (x: string) => void, label: string) => (
    <Field label={label}>
      <div className="flex gap-2">
        <input type="color" value={v} onChange={(e) => set(e.target.value)} className="h-11 w-14 cursor-pointer rounded-xl border border-sand-300 bg-white p-1" />
        <Input name={name} value={v} onChange={(e) => set(e.target.value)} pattern="^#[0-9A-Fa-f]{6}$" dir="ltr" />
      </div>
    </Field>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={t.logo} />
        <ActionForm action={uploadLogo} className="flex flex-wrap items-center gap-4 p-5">
          <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl" style={{ background: primary }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.logo_url || DEFAULT_LOGO} alt="" className="h-12 w-12 object-contain" />
          </div>
          <input type="file" name="logo" accept="image/png,image/jpeg,image/svg+xml,image/webp" required className="text-sm file:me-3 file:rounded-lg file:border-0 file:bg-sand-100 file:px-3 file:py-2 file:text-sm" />
          <SubmitButton variant="outline" size="sm">{t.uploadLogo}</SubmitButton>
        </ActionForm>
      </Card>

      <ActionForm action={updateSettings} className="space-y-6" successText={d.common.saved}>
        <Card>
          <CardHeader title={t.identity} />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label={t.nameAr} required><Input name="name_ar" defaultValue={s.name_ar} required /></Field>
            <Field label={t.nameEn} required><Input name="name_en" defaultValue={s.name_en} required dir="ltr" /></Field>
            <Field label={t.taglineAr}><Input name="tagline_ar" defaultValue={s.tagline_ar ?? ''} /></Field>
            <Field label={t.taglineEn}><Input name="tagline_en" defaultValue={s.tagline_en ?? ''} dir="ltr" /></Field>
            {color('primary_color', primary, setPrimary, t.primary)}
            {color('accent_color', accent, setAccent, t.accent)}
            <div className="sm:col-span-2">
              <div className="mb-1.5 text-xs text-stone-450">{t.preview}</div>
              <div className="flex items-center gap-3 rounded-2xl p-4 text-white" style={{ background: primary }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.logo_url || DEFAULT_LOGO} alt="" className="h-10 w-10 object-contain" />
                <span className="flex-1 font-medium">{locale === 'ar' ? s.name_ar : s.name_en}</span>
                <span className="rounded-xl px-4 py-2 text-sm font-medium" style={{ background: accent }}>{d.cl.site.nav.book}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title={t.contact} />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label={d.common.phone}><Input name="support_phone" type="tel" defaultValue={s.support_phone ?? ''} /></Field>
            <Field label={d.common.email}><Input name="support_email" type="email" defaultValue={s.support_email ?? ''} /></Field>
            <Field label={t.whatsapp}><Input name="whatsapp" type="tel" dir="ltr" defaultValue={s.whatsapp ?? ''} placeholder="9665XXXXXXXX" /></Field>
            <Field label={t.mapQuery}><Input name="map_query" dir="ltr" defaultValue={s.map_query ?? ''} placeholder="21.56,39.15" /></Field>
            <Field label={t.addressAr}><Input name="address_ar" defaultValue={s.address_ar ?? ''} /></Field>
            <Field label={t.addressEn}><Input name="address_en" dir="ltr" defaultValue={s.address_en ?? ''} /></Field>
            <Field label={t.hoursAr}><Input name="working_hours_ar" defaultValue={s.working_hours_ar ?? ''} /></Field>
            <Field label={t.hoursEn}><Input name="working_hours_en" dir="ltr" defaultValue={s.working_hours_en ?? ''} /></Field>
            <div className="text-[13px] font-medium text-ink/80 sm:col-span-2">{t.social}</div>
            <Field label="Website"><Input name="website_url" type="url" dir="ltr" defaultValue={s.website_url ?? ''} /></Field>
            <Field label="Instagram"><Input name="instagram_url" type="url" dir="ltr" defaultValue={s.instagram_url ?? ''} /></Field>
            <Field label="X"><Input name="x_url" type="url" dir="ltr" defaultValue={s.x_url ?? ''} /></Field>
            <Field label="Snapchat"><Input name="snapchat_url" type="url" dir="ltr" defaultValue={s.snapchat_url ?? ''} /></Field>
            <Field label="TikTok"><Input name="tiktok_url" type="url" dir="ltr" defaultValue={s.tiktok_url ?? ''} /></Field>
          </div>
        </Card>

        <Card>
          <CardHeader title={t.official} />
          <div className="grid gap-4 p-5 sm:grid-cols-4">
            <Field label={t.cr}><Input name="cr_number" dir="ltr" defaultValue={s.cr_number ?? ''} /></Field>
            <Field label={t.moh}><Input name="moh_license" dir="ltr" defaultValue={s.moh_license ?? ''} /></Field>
            <Field label={t.vatNo}><Input name="vat_number" dir="ltr" defaultValue={s.vat_number ?? ''} /></Field>
            <Field label={t.vatRate}><Input name="vat_rate" type="number" step="0.5" min="0" max="100" defaultValue={s.vat_rate ?? 15} /></Field>
          </div>
        </Card>

        <Card>
          <CardHeader title={t.booking} />
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Field label={t.cancelWindow}><Input name="cancel_window_hours" type="number" min={0} max={72} defaultValue={s.cancel_window_hours ?? 3} /></Field>
            <Field label={t.daysAhead}><Input name="booking_days_ahead" type="number" min={1} max={180} defaultValue={s.booking_days_ahead ?? 30} /></Field>
            <Field label={t.lateMinutes}><Input name="late_checkin_minutes" type="number" min={0} max={240} defaultValue={s.late_checkin_minutes ?? 20} /></Field>
          </div>
        </Card>

        <Card>
          <CardHeader title={t.channels} subtitle={t.channelsHint} />
          <div className="flex flex-wrap gap-3 p-5">
            {(['whatsapp', 'sms', 'email'] as const).map((c) => (
              <label key={c} className="flex items-center gap-2 rounded-xl border border-sand-200 px-4 py-2.5 text-sm">
                <input type="checkbox" name="notify_channels" value={c} defaultChecked={s.notify_channels.includes(c)} className="h-4 w-4 rounded border-sand-300 text-brand focus:ring-brand" />
                {c === 'whatsapp' ? 'WhatsApp' : c === 'sms' ? 'SMS' : 'Email'}
                <span className={providers[c] ? 'text-xs text-emerald-700' : 'text-xs text-stone-450'}>· {providers[c] || d.portal.notConfigured}</span>
              </label>
            ))}
          </div>
          <div className="border-t border-sand-100 p-5">
            <div className="mb-2 text-sm font-medium">{t.notifyRoles}</div>
            <div className="flex flex-wrap gap-3">
              {(['patient', 'doctor', 'reception', 'admin'] as const).map((r) => (
                <label key={r} className="flex items-center gap-2 rounded-xl border border-sand-200 px-4 py-2.5 text-sm">
                  <input type="checkbox" name="notify_roles" value={r} defaultChecked={(s.notify_roles ?? ['patient']).includes(r)} className="h-4 w-4 rounded border-sand-300 text-brand focus:ring-brand" />
                  {d.roles[r]}
                </label>
              ))}
            </div>
          </div>
        </Card>

        <SubmitButton size="lg">{d.common.save}</SubmitButton>
      </ActionForm>
    </div>
  );
}

export function NotifyTestForm() {
  const { d } = useI18n();
  return (
    <Card>
      <CardHeader title={d.portal.testSend} />
      <ActionForm action={sendTestMessage} className="grid gap-3 p-5 sm:grid-cols-[140px_1fr_auto] sm:items-end">
        <Field label={d.cl.adm.settings.channels}>
          <select name="channel" className="h-11 w-full rounded-xl border border-sand-200 bg-white px-3 text-sm">
            <option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="email">Email</option>
          </select>
        </Field>
        <Field label={d.portal.testPhone}><Input name="to" dir="ltr" placeholder="05XXXXXXXX" required /></Field>
        <SubmitButton variant="outline">{d.portal.testSend}</SubmitButton>
      </ActionForm>
    </Card>
  );
}
