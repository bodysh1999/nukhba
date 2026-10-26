export const APPLICATION_STATUSES = ['new', 'screening', 'interview', 'offer', 'hired', 'accepted', 'rejected', 'archived'] as const;
export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'training'] as const;
export const APP_TONE: Record<string, string> = {
  new: 'bg-sky-50 text-sky-800 ring-sky-200', screening: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  interview: 'bg-violet-50 text-violet-800 ring-violet-200', offer: 'bg-amber-50 text-amber-800 ring-amber-200',
  hired: 'bg-emerald-50 text-emerald-800 ring-emerald-200', accepted: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  rejected: 'bg-stone-100 text-stone-600 ring-stone-200', archived: 'bg-stone-100 text-stone-600 ring-stone-200',
};
