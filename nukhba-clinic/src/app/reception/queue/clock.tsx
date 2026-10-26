'use client';

import { useEffect, useState } from 'react';

export function Clock({ locale }: { locale: 'ar' | 'en' }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  if (!now) return null;
  return (
    <span className="tabular-nums">
      {new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Riyadh' }).format(now)}
    </span>
  );
}
