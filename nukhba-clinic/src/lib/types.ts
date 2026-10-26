export type Role = 'admin' | 'reception' | 'doctor' | 'accountant' | 'hr' | 'employee' | 'patient';
export type Locale = 'ar' | 'en';

export type AppointmentStatus = 'booked' | 'confirmed' | 'checked_in' | 'in_consultation' | 'completed' | 'cancelled' | 'no_show';
export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'cancelled';
export type ClaimStatus = 'none' | 'pending' | 'submitted' | 'approved' | 'partially_approved' | 'rejected' | 'paid';
export type PayMethod = 'cash' | 'mada' | 'card' | 'apple_pay' | 'transfer';
export type DoctorTitle = 'consultant' | 'specialist' | 'resident' | 'gp';
export type TestStatus = 'ordered' | 'collected' | 'resulted' | 'cancelled';
export type TestFlag = 'normal' | 'abnormal' | 'critical';
export type DocKind = 'sick_leave' | 'medical_report' | 'referral';

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  email: string | null;
  phone: string | null;
  locale: Locale;
  is_active: boolean;
  notify_external?: boolean;
  privacy_accepted_version?: string | null;
  privacy_accepted_at?: string | null;
}

export interface CompanySettings {
  name_ar: string;
  name_en: string;
  tagline_ar?: string;
  tagline_en?: string;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  support_phone: string | null;
  support_email: string | null;
  whatsapp: string | null;
  website_url: string | null;
  instagram_url: string | null;
  snapchat_url: string | null;
  tiktok_url: string | null;
  x_url?: string | null;
  address_ar?: string | null;
  address_en?: string | null;
  map_query?: string | null;
  working_hours_ar?: string | null;
  working_hours_en?: string | null;
  cr_number?: string | null;
  moh_license?: string | null;
  vat_number?: string | null;
  vat_rate?: number;
  cancel_window_hours?: number;
  booking_days_ahead?: number;
  late_checkin_minutes?: number;
  notify_channels: string[];
  notify_roles?: string[];
  privacy_version?: string;
  privacy_updated_on?: string;
  dpo_name?: string | null;
  dpo_email?: string | null;
  data_hosting_region?: string | null;
  retention_cv_months?: number;
  retention_leads_months?: number;
  retention_notif_days?: number;
  require_staff_mfa?: boolean;
  gosi_saudi_rate?: number;
  gosi_resident_rate?: number;
  trip_per_diem?: number;
  hr_letter_signatory?: string | null;
  hr_signatory_title?: string | null;
  hr_signature_url?: string | null;
}

export interface Clinic {
  id: string; code: string; name_ar: string; name_en: string; description_ar: string | null; description_en: string | null;
  icon: string; image_url: string | null; location_ar: string | null; location_en: string | null; sort: number; is_active: boolean;
}

export interface Doctor {
  id: string; clinic_id: string; profile_id?: string | null; full_name_ar: string; full_name_en: string | null; title: DoctorTitle;
  gender: 'male' | 'female'; specialty_ar: string | null; specialty_en: string | null; bio_ar: string | null; bio_en: string | null;
  photo_url: string | null; languages: string[]; qualifications: string | null; years_experience: number | null;
  consultation_fee: number; follow_up_fee: number; slot_minutes: number; accepts_online: boolean; show_public: boolean; is_active: boolean;
  scfhs_no?: string | null;
}

export interface Patient {
  id: string; file_no: string; profile_id: string | null; full_name: string; full_name_en: string | null; national_id: string | null;
  is_saudi: boolean; nationality: string | null; gender: 'male' | 'female'; birth_date: string | null; phone: string; email: string | null;
  city: string | null; blood_type: string | null; allergies: string | null; chronic_conditions: string | null; current_medications: string | null;
  insurance_company_id: string | null; insurance_member_no: string | null; insurance_class: string | null; insurance_expiry: string | null;
  emergency_name: string | null; emergency_phone: string | null; account_status: 'none' | 'active' | 'disabled'; notes: string | null; created_at: string;
}

export interface AppointmentRow {
  id: string; ref_no: string; patient_id: string; doctor_id: string; clinic_id: string; starts_at: string; ends_at: string;
  visit_type: 'new' | 'follow_up'; source: 'online' | 'reception' | 'phone' | 'website'; status: AppointmentStatus;
  reason: string | null; cancel_reason: string | null; queue_no: number | null; confirmed_at: string | null; checked_in_at: string | null;
  called_at: string | null; completed_at: string | null; cancelled_at: string | null; created_at: string;
}

export interface AppointmentOverview extends AppointmentRow {
  file_no: string; patient_name: string; patient_phone: string; patient_gender: 'male' | 'female'; patient_birth_date: string | null;
  patient_national_id: string | null; insurance_company_id: string | null; insurance_name_ar: string | null; insurance_name_en: string | null;
  doctor_name_ar: string; doctor_name_en: string | null; doctor_title: DoctorTitle; doctor_photo: string | null;
  clinic_name_ar: string; clinic_name_en: string; clinic_icon: string; clinic_location_ar: string | null; clinic_location_en: string | null;
  visit_id: string | null; visit_status: 'open' | 'signed' | null;
  invoice_id: string | null; inv_no: string | null; invoice_status: InvoiceStatus | null; patient_amount: number | null; paid_amount: number | null;
  payer: 'self' | 'insurance' | null; rating_score: number | null; waiting_minutes: number | null;
}

export interface Visit {
  id: string; appointment_id: string; patient_id: string; doctor_id: string; clinic_id: string;
  bp_systolic: number | null; bp_diastolic: number | null; pulse: number | null; temperature: number | null; resp_rate: number | null;
  spo2: number | null; weight_kg: number | null; height_cm: number | null; chief_complaint: string | null; history: string | null;
  examination: string | null; diagnosis: string | null; icd10_code: string | null; plan: string | null; patient_advice: string | null;
  follow_up_in_days: number | null; status: 'open' | 'signed'; signed_at: string | null; created_at: string;
}

export interface RxItem { id: string; visit_id: string; drug_name: string; dose: string | null; frequency: string | null; duration: string | null; route: string | null; instructions: string | null }

export interface TestOrder {
  id: string; visit_id: string; patient_id: string; service_id: string | null; test_name: string; kind: 'lab' | 'radiology';
  status: TestStatus; result_text: string | null; result_flag: TestFlag | null; result_file: string | null; resulted_at: string | null; created_at: string;
}

export interface MedicalDoc {
  id: string; ref_no: string; visit_id: string; patient_id: string; doctor_id: string; kind: DocKind; from_date: string | null; to_date: string | null;
  body: string | null; referral_to: string | null; verify_code: string; issued_at: string; revoked_at: string | null;
}

export interface Invoice {
  id: string; inv_no: string; patient_id: string; appointment_id: string | null; status: InvoiceStatus; payer: 'self' | 'insurance';
  insurance_company_id: string | null; coverage_percent: number; max_copay: number | null; approval_no: string | null;
  subtotal: number; discount: number; net_amount: number; vat_rate: number; vat_amount: number; total: number;
  insurance_amount: number; patient_amount: number; paid_amount: number; claim_status: ClaimStatus; claim_submitted_at: string | null;
  claim_approved_amount: number | null; claim_paid_at: string | null; claim_note: string | null; notes: string | null;
  issued_at: string | null; cancelled_at: string | null; cancel_reason: string | null; created_at: string;
}

export interface Service { id: string; code: string; name_ar: string; name_en: string | null; kind: string; clinic_id: string | null; price: number; is_active: boolean }
export interface Insurer { id: string; code: string | null; name_ar: string; name_en: string | null; coverage_percent: number; max_copay: number | null; requires_approval: boolean; phone: string | null; email: string | null; is_active: boolean }

export type ActionResult = { ok?: boolean; error?: string; message?: string; data?: Record<string, unknown> } | undefined;
