import type { AppointmentStatus, ClaimStatus, InvoiceStatus, PayMethod, TestFlag } from './types';

/** The patient-facing journey of an appointment */
export const APPT_STAGES: AppointmentStatus[] = ['booked', 'confirmed', 'checked_in', 'in_consultation', 'completed'];
export const ALL_APPT_STATUSES: AppointmentStatus[] = [...APPT_STAGES, 'cancelled', 'no_show'];
export const ACTIVE_APPT: AppointmentStatus[] = ['booked', 'confirmed', 'checked_in', 'in_consultation'];

export const APPT_TONE: Record<AppointmentStatus, string> = {
  booked: 'bg-sky-50 text-sky-800 ring-sky-200',
  confirmed: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  checked_in: 'bg-amber-50 text-amber-800 ring-amber-200',
  in_consultation: 'bg-violet-50 text-violet-800 ring-violet-200',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  cancelled: 'bg-stone-100 text-stone-600 ring-stone-200',
  no_show: 'bg-rose-50 text-rose-800 ring-rose-200',
};
export const APPT_HEX: Record<AppointmentStatus, string> = {
  booked: '#0EA5E9', confirmed: '#6366F1', checked_in: '#F59E0B', in_consultation: '#8B5CF6',
  completed: '#10B981', cancelled: '#A8A29E', no_show: '#F43F5E',
};

export const INVOICE_TONE: Record<InvoiceStatus, string> = {
  draft: 'bg-stone-100 text-stone-700 ring-stone-200',
  issued: 'bg-amber-50 text-amber-800 ring-amber-200',
  partially_paid: 'bg-orange-50 text-orange-800 ring-orange-200',
  paid: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  cancelled: 'bg-stone-100 text-stone-500 ring-stone-200',
};
export const CLAIM_STATUSES: ClaimStatus[] = ['pending', 'submitted', 'approved', 'partially_approved', 'rejected', 'paid'];
export const CLAIM_TONE: Record<ClaimStatus, string> = {
  none: 'bg-stone-100 text-stone-600 ring-stone-200',
  pending: 'bg-sky-50 text-sky-800 ring-sky-200',
  submitted: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  approved: 'bg-teal-50 text-teal-800 ring-teal-200',
  partially_approved: 'bg-amber-50 text-amber-800 ring-amber-200',
  rejected: 'bg-rose-50 text-rose-800 ring-rose-200',
  paid: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
};
export const PAY_METHODS: PayMethod[] = ['mada', 'cash', 'card', 'apple_pay', 'transfer'];
export const FLAG_TONE: Record<TestFlag, string> = {
  normal: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  abnormal: 'bg-amber-50 text-amber-800 ring-amber-200',
  critical: 'bg-rose-600 text-white ring-rose-600',
};
export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const WEEKDAYS = [6, 0, 1, 2, 3, 4, 5]; // Saturday first (Saudi week)

/** Common drug frequencies for the prescription pad */
export const RX_FREQ_AR = ['مرة يوميًا', 'مرتين يوميًا', '3 مرات يوميًا', 'كل 8 ساعات', 'كل 6 ساعات', 'عند الحاجة', 'قبل النوم', 'مرة أسبوعيًا'];
export const RX_FREQ_EN = ['Once daily', 'Twice daily', '3 times daily', 'Every 8 hours', 'Every 6 hours', 'As needed', 'At bedtime', 'Once weekly'];

/** Frequent ICD-10 codes — the doctor can type any other */
export const ICD10_COMMON: [string, string, string][] = [
  ['J02.9', 'التهاب البلعوم الحاد', 'Acute pharyngitis'],
  ['J06.9', 'عدوى الجهاز التنفسي العلوي', 'Upper respiratory infection'],
  ['I10', 'ارتفاع ضغط الدم الأساسي', 'Essential hypertension'],
  ['E11.9', 'داء السكري من النوع الثاني', 'Type 2 diabetes mellitus'],
  ['E78.5', 'ارتفاع الدهون في الدم', 'Hyperlipidemia'],
  ['E55.9', 'نقص فيتامين د', 'Vitamin D deficiency'],
  ['K21.9', 'ارتجاع المريء', 'Gastro-esophageal reflux'],
  ['K58.9', 'القولون العصبي', 'Irritable bowel syndrome'],
  ['N39.0', 'التهاب المسالك البولية', 'Urinary tract infection'],
  ['H66.9', 'التهاب الأذن الوسطى', 'Otitis media'],
  ['A09', 'نزلة معوية', 'Gastroenteritis'],
  ['J45.9', 'الربو', 'Asthma'],
  ['M54.5', 'آلام أسفل الظهر', 'Low back pain'],
  ['M17.9', 'خشونة الركبة', 'Knee osteoarthritis'],
  ['L70.0', 'حب الشباب', 'Acne vulgaris'],
  ['L30.9', 'الأكزيما', 'Dermatitis / eczema'],
  ['K02.9', 'تسوس الأسنان', 'Dental caries'],
  ['K05.1', 'التهاب اللثة المزمن', 'Chronic gingivitis'],
  ['H52.1', 'قصر النظر', 'Myopia'],
  ['H10.9', 'التهاب الملتحمة', 'Conjunctivitis'],
  ['Z34.9', 'متابعة حمل طبيعي', 'Normal pregnancy supervision'],
  ['G44.2', 'صداع توتري', 'Tension-type headache'],
];

export function ageOf(birth: string | null | undefined): number | null {
  if (!birth) return null;
  const b = new Date(birth);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

export function bmiOf(w: number | null, h: number | null): number | null {
  if (!w || !h) return null;
  return Math.round((w / ((h / 100) ** 2)) * 10) / 10;
}
