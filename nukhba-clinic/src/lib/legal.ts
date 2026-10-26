import type { CompanySettings, Locale } from './types';

export type LegalSection = { title: string; body: (string | string[])[] };
type S = CompanySettings & {
  privacy_version?: string; privacy_updated_on?: string; dpo_name?: string | null; dpo_email?: string | null;
  data_hosting_region?: string | null; retention_cv_months?: number; retention_leads_months?: number; retention_notif_days?: number;
};

/** Privacy policy (PDPL arts. 12–13): who we are, what we collect, why, legal basis, sharing, location, retention, rights */
export function privacyPolicy(locale: Locale, s: S): LegalSection[] {
  const name = locale === 'ar' ? s.name_ar : s.name_en;
  const contact = [s.dpo_email || s.support_email, s.support_phone].filter(Boolean).join(' · ');
  const region = s.data_hosting_region || (locale === 'ar' ? 'مزودي خدمات سحابية موثوقين' : 'trusted cloud providers');
  const cv = s.retention_cv_months ?? 24, leads = s.retention_leads_months ?? 24, notif = s.retention_notif_days ?? 365;

  if (locale === 'en') {
    return [
      { title: '1. Who we are', body: [
        `${name} ("the Center") is the controller of the personal data processed through this website and its portals (patients, doctors and staff).`,
        `Data protection contact: ${s.dpo_name ? `${s.dpo_name} — ` : ''}${contact || '—'}.`,
      ] },
      { title: '2. Data we collect', body: [[
        'Visitors: name, mobile, email, the clinic or doctor you ask about, preferred appointment time, insurance company and your message.',
        'Job and training applicants: contact details, education, experience, LinkedIn link and CV.',
        'Patients: name, national ID/Iqama, date of birth, gender, mobile, email, insurance details, appointments, and health data — vital signs, allergies and chronic conditions, diagnoses, prescriptions, lab and radiology results, medical reports and sick-leave notes — plus invoices, payments and ratings.',
        'Employees: identity and contact data, job and department, hire date, contract, salary and allowances, ID/residency and bank details, attendance with location at check-in/out, leave and other requests and their attachments.',
        'Doctors: name, specialty, professional classification, photo, schedules and consultations.',
        'Technical data: sign-in session and language cookies, and records of changes to sensitive data.',
      ]] },
      { title: '3. Why we use it and on what legal basis', body: [[
        'Answering your booking or job request — your consent and taking steps at your request.',
        'Providing medical care, keeping the medical record and issuing prescriptions and reports — providing the health service you requested and the health-practice regulations.',
        'Billing, insurance approvals and claims, and tax invoices — the service contract, the insurance policy and ZATCA rules.',
        'Employment, payroll data, attendance and HR letters — the employment contract and the Labor Law.',
        'Sending appointment confirmations, reminders and result notifications by WhatsApp/SMS — your consent, which you can withdraw at any time.',
        'Security, fraud prevention and auditing changes — our legal obligations and legitimate interest in protecting the data.',
      ]] },
      { title: '4. Who receives it', body: [[
        'Center staff, each according to their role only: your treating doctor sees your record; reception sees appointments and contact data; accounts see invoices; HR sees employee data only.',
        'Your insurance company — only what the approval or claim requires (diagnosis, services and amounts).',
        'The Ministry of Health and competent authorities when required by law (e.g. notifiable diseases).',
        'Service providers acting on our behalf: cloud hosting, messaging (SMS/WhatsApp) and email providers, bound by contracts.',
        'We do not sell personal data.',
      ]] },
      { title: '5. Where it is stored', body: [
        `Data is stored with ${region}. When data is processed outside the Kingdom, this is done according to the Regulation on Personal Data Transfer Outside the Kingdom and with appropriate safeguards.`,
      ] },
      { title: '6. How long we keep it', body: [[
        `Visitor booking requests: up to ${leads} months.`,
        `CVs and applications: up to ${cv} months unless you are hired.`,
        `Notifications: ${notif} days.`,
        'Medical records: for the periods required by health regulations, even if you stop visiting.',
        'Invoices and payments: for the periods required by tax law.',
        'Employee records: for the employment and the periods required by the Labor Law.',
        'Change (audit) records: 5 years.',
      ]] },
      { title: '7. How we protect it', body: [
        'Encrypted connections, role-based permissions enforced in the database (each user sees only their own data), medical files served only through short-lived links, private doctor notes never shown to the patient, partial masking of ID numbers on public verification pages, optional two-step login, and a record of changes to sensitive data.',
      ] },
      { title: '8. Your rights', body: [[
        'To know how your data is processed (this policy).',
        'To get a copy of your data — from "My data & privacy" in the portal, instantly.',
        'To correct incomplete or wrong data.',
        'To request deletion when the data is no longer needed, unless the law requires keeping it.',
        'To withdraw consent at any time, as easily as you gave it.',
        'We answer requests within 30 days. You can also contact us at the details above.',
        'You may file a complaint with the Saudi Data & AI Authority (SDAIA).',
      ]] },
      { title: '9. Cookies', body: ['We only use cookies needed for signing in and remembering your language. We do not use advertising or tracking cookies.'] },
      { title: '10. Changes', body: [`This is version ${s.privacy_version ?? '1.0'}. When we change it materially, we ask you to accept the new version in the portal.`] },
    ];
  }

  return [
    { title: '1. من نحن', body: [
      `${name} ("المركز") هي الجهة المسؤولة (جهة التحكم) عن البيانات الشخصية التي تُعالج عبر هذا الموقع وبواباته (المرضى، الأطباء، الموظفين).`,
      `التواصل بخصوص حماية البيانات: ${s.dpo_name ? `${s.dpo_name} — ` : ''}${contact || '—'}.`,
    ] },
    { title: '2. البيانات التي نجمعها', body: [[
      'الزوار: الاسم، الجوال، البريد، العيادة أو الطبيب المطلوب، الموعد المفضل، شركة التأمين، ورسالتك.',
      'المتقدمون للتوظيف والتدريب: بيانات التواصل، المؤهل، الخبرة، رابط لينكدإن، والسيرة الذاتية.',
      'المرضى: الاسم، رقم الهوية أو الإقامة، تاريخ الميلاد، الجنس، الجوال، البريد، بيانات التأمين، المواعيد، والبيانات الصحية — العلامات الحيوية، الحساسية والأمراض المزمنة، التشخيص، الوصفات، نتائج التحاليل والأشعة، التقارير الطبية والإجازات المرضية — إضافة إلى الفواتير والمدفوعات والتقييمات.',
      'الموظفون: بيانات الهوية والتواصل، الوظيفة والقسم، تاريخ المباشرة، العقد، الراتب والبدلات، رقم الهوية أو الإقامة والحساب البنكي، الحضور والانصراف مع الموقع وقت البصمة، الإجازات والطلبات ومرفقاتها.',
      'الأطباء: الاسم، التخصص، التصنيف المهني، الصورة، الجداول والزيارات.',
      'بيانات تقنية: ملفات تعريف الارتباط الخاصة بتسجيل الدخول واللغة، وسجل التعديلات على البيانات الحساسة.',
    ]] },
    { title: '3. أغراض المعالجة والأساس النظامي', body: [[
      'الرد على طلب الحجز أو التوظيف — بناءً على موافقتك وطلبك.',
      'تقديم الرعاية الطبية وحفظ الملف الطبي وإصدار الوصفات والتقارير — لتقديم الخدمة الصحية التي طلبتها ووفق أنظمة مزاولة المهن الصحية.',
      'الفوترة وموافقات التأمين ومطالباته والفواتير الضريبية — تنفيذًا لعقد الخدمة ووثيقة التأمين وأنظمة هيئة الزكاة والضريبة والجمارك.',
      'التوظيف والرواتب والحضور وخطابات الموارد البشرية — تنفيذًا لعقد العمل ونظام العمل.',
      'إرسال تأكيد المواعيد والتذكير وإشعارات النتائج عبر واتساب و SMS — بناءً على موافقتك، ويمكنك سحبها في أي وقت.',
      'الأمان ومنع الاحتيال وتوثيق التعديلات — التزامًا بالأنظمة وحمايةً للبيانات.',
    ]] },
    { title: '4. الجهات التي تستلم البيانات', body: [[
      'منسوبو المركز، كلٌ حسب دوره فقط: طبيبك المعالج يرى ملفك الطبي، والاستقبال يرى المواعيد وبيانات التواصل، والحسابات ترى الفواتير، والموارد البشرية ترى بيانات الموظفين فقط.',
      'شركة التأمين الخاصة بك — بالقدر اللازم للموافقة أو المطالبة فقط (التشخيص والخدمات والمبالغ).',
      'وزارة الصحة والجهات المختصة عندما يتطلب النظام ذلك (مثل الأمراض واجبة التبليغ).',
      'مزودو خدمات يعملون نيابة عنا: الاستضافة السحابية، ومزودو الرسائل (SMS وواتساب) والبريد، بموجب عقود.',
      'لا نبيع البيانات الشخصية.',
    ]] },
    { title: '5. مكان حفظ البيانات', body: [
      `تُحفظ البيانات لدى ${region}. وعند معالجة البيانات خارج المملكة يتم ذلك وفق لائحة نقل البيانات الشخصية إلى خارج المملكة وبالضمانات المناسبة.`,
    ] },
    { title: '6. مدة الاحتفاظ', body: [[
      `طلبات الحجز من الزوار: حتى ${leads} شهرًا.`,
      `السير الذاتية وطلبات التوظيف: حتى ${cv} شهرًا ما لم يتم التوظيف.`,
      `الإشعارات: ${notif} يومًا.`,
      'الملفات الطبية: طوال المدد التي تتطلبها الأنظمة الصحية، حتى لو توقفت عن المراجعة.',
      'الفواتير والمدفوعات: طوال المدد التي تتطلبها الأنظمة الضريبية.',
      'سجلات الموظفين: طوال مدة العمل والمدد التي يتطلبها نظام العمل.',
      'سجل التعديلات: 5 سنوات.',
    ]] },
    { title: '7. حماية البيانات', body: [
      'اتصال مشفّر، وصلاحيات مطبقة على مستوى قاعدة البيانات بحيث يرى كل مستخدم بياناته فقط، وملفات طبية لا تُفتح إلا بروابط مؤقتة، وملاحظات الطبيب الخاصة لا تظهر للمريض، وإخفاء جزئي لأرقام الهوية في صفحات التحقق العامة، وتحقق بخطوتين، وسجل للتعديلات على البيانات الحساسة.',
    ] },
    { title: '8. حقوقك', body: [[
      'العلم بكيفية معالجة بياناتك (هذه السياسة).',
      'الحصول على نسخة من بياناتك — فورًا من صفحة "بياناتي وخصوصيتي" في البوابة.',
      'تصحيح البيانات الناقصة أو غير الصحيحة.',
      'طلب حذف البيانات عند انتفاء الحاجة إليها، ما لم يُلزمنا النظام بالاحتفاظ بها.',
      'سحب موافقتك في أي وقت وبنفس سهولة منحها.',
      'نرد على الطلبات خلال 30 يومًا، ويمكنك التواصل معنا عبر البيانات أعلاه.',
      'يحق لك تقديم شكوى إلى الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا).',
    ]] },
    { title: '9. ملفات تعريف الارتباط', body: ['لا نستخدم إلا ملفات تعريف الارتباط الضرورية لتسجيل الدخول وتذكّر اللغة، ولا نستخدم ملفات إعلانية أو للتتبع.'] },
    { title: '10. التعديلات', body: [`هذا الإصدار ${s.privacy_version ?? '1.0'}. عند أي تعديل جوهري نطلب منك الموافقة على الإصدار الجديد داخل البوابة.`] },
  ];
}

/** Terms of use for the website and portals */
export function termsOfUse(locale: Locale, s: S): LegalSection[] {
  const name = locale === 'ar' ? s.name_ar : s.name_en;
  if (locale === 'en') {
    return [
      { title: '1. Acceptance', body: [`By using this website or its portals you accept these terms and the privacy policy of ${name}.`] },
      { title: '2. Accounts', body: [[
        'Patients may create an account with their national ID/Iqama and mobile, or have one created by reception. Staff and doctor accounts are created by the Center.',
        'Keep your password confidential and change any temporary password. You are responsible for activity under your account.',
        'The Center may suspend accounts that are misused or no longer related to it.',
      ]] },
      { title: '3. Appointments', body: [[
        'An appointment is confirmed once it appears in your portal or you receive a confirmation message.',
        `You can cancel or reschedule from the portal up to ${s.cancel_window_hours ?? 4} hours before the appointment; after that please call reception.`,
        `Please arrive 15 minutes early. If you arrive more than ${s.late_checkin_minutes ?? 15} minutes late, the appointment may be given to another patient or rescheduled.`,
        'Repeated no-shows may limit online booking for your account.',
      ]] },
      { title: '4. Medical services', body: [[
        'The website and portal do not replace a medical consultation and are not for emergencies — in an emergency call 997 or go to the nearest emergency department.',
        'Medical results shown in the portal are released after the doctor reviews them; discuss them with your doctor.',
      ]] },
      { title: '5. Fees and insurance', body: [[
        'Prices shown on the website are indicative; the final invoice is issued at the visit.',
        'Insurance coverage depends on your policy and the insurer’s approval; you pay the co-pay and any service not covered.',
        'VAT is applied according to the regulations in force.',
      ]] },
      { title: '6. Documents', body: ['Prescriptions, medical reports and sick-leave notes issued by the system carry a QR code and can be verified on the Center’s verification page.'] },
      { title: '7. Liability', body: ['The Center works to keep the service available and secure, but it may be interrupted for maintenance or reasons beyond its control.'] },
      { title: '8. Governing law', body: ['These terms are governed by the laws of the Kingdom of Saudi Arabia, and the competent Saudi courts have jurisdiction.'] },
    ];
  }
  return [
    { title: '1. القبول', body: [`باستخدامك هذا الموقع أو بواباته فإنك توافق على هذه الشروط وعلى سياسة الخصوصية الخاصة بـ ${name}.`] },
    { title: '2. الحسابات', body: [[
      'يمكن للمريض إنشاء حساب برقم الهوية أو الإقامة والجوال، أو ينشئه له الاستقبال. أما حسابات الأطباء والموظفين فينشئها المركز.',
      'حافظ على سرية كلمة المرور وغيّر كلمة المرور المؤقتة، وأنت مسؤول عن أي نشاط يتم من خلال حسابك.',
      'يحق للمركز إيقاف الحسابات التي يُساء استخدامها أو لم تعد ذات علاقة به.',
    ]] },
    { title: '3. المواعيد', body: [[
      'يُعد الموعد مؤكدًا عند ظهوره في بوابتك أو وصول رسالة التأكيد.',
      `يمكنك الإلغاء أو التأجيل من البوابة قبل الموعد بـ ${s.cancel_window_hours ?? 4} ساعات على الأقل، وبعدها يُرجى الاتصال بالاستقبال.`,
      `يُرجى الحضور قبل الموعد بـ 15 دقيقة، وفي حال التأخر أكثر من ${s.late_checkin_minutes ?? 15} دقيقة قد يُعطى الموعد لمريض آخر أو يُعاد جدولته.`,
      'تكرار عدم الحضور قد يقيّد الحجز الإلكتروني لحسابك.',
    ]] },
    { title: '4. الخدمات الطبية', body: [[
      'الموقع والبوابة لا يغنيان عن الاستشارة الطبية وليسا للحالات الطارئة — في الطوارئ اتصل على 997 أو توجّه لأقرب طوارئ.',
      'تظهر النتائج في البوابة بعد مراجعة الطبيب لها، ويُرجى مناقشتها مع طبيبك.',
    ]] },
    { title: '5. الرسوم والتأمين', body: [[
      'الأسعار المعروضة في الموقع استرشادية، وتصدر الفاتورة النهائية عند الزيارة.',
      'تعتمد التغطية التأمينية على وثيقتك وموافقة شركة التأمين، وتتحمل نسبة التحمل وأي خدمة غير مغطاة.',
      'تُطبق ضريبة القيمة المضافة وفق الأنظمة المعمول بها.',
    ]] },
    { title: '6. المستندات', body: ['الوصفات والتقارير الطبية والإجازات المرضية الصادرة من النظام تحمل رمز QR ويمكن التحقق منها عبر صفحة التحقق في موقع المركز.'] },
    { title: '7. المسؤولية', body: ['يعمل المركز على إتاحة الخدمة وأمانها، وقد تتوقف الخدمة مؤقتًا للصيانة أو لأسباب خارجة عن إرادته.'] },
    { title: '8. النظام الواجب التطبيق', body: ['تخضع هذه الشروط لأنظمة المملكة العربية السعودية، وتختص المحاكم السعودية المختصة بأي نزاع.'] },
  ];
}

/** Record of processing activities (PDPL) — shown to the admin and printable */
export function processingRecord(locale: Locale, s: S) {
  const ar = locale === 'ar';
  const cv = s.retention_cv_months ?? 24, leads = s.retention_leads_months ?? 24;
  const rows: [string, string, string, string, string, string][] = ar ? [
    ['طلبات الحجز من الزوار', 'الاسم، الجوال، البريد، العيادة/الطبيب، التأمين، الرسالة', 'التواصل وتأكيد الموعد', 'الموافقة', `${leads} شهرًا`, 'الاستقبال'],
    ['الملف الطبي', 'الهوية، تاريخ الميلاد، العلامات الحيوية، الحساسية، التشخيص، الوصفات، التحاليل، التقارير', 'تقديم الرعاية الطبية', 'تقديم الخدمة الصحية والأنظمة الصحية', 'وفق الأنظمة الصحية', 'الطبيب المعالج، المريض (بعد الاعتماد)'],
    ['المواعيد والاستقبال', 'بيانات التواصل، المواعيد، الحضور، رقم الدور', 'تنظيم الزيارات', 'تقديم الخدمة', 'مدة العلاقة', 'الاستقبال، الطبيب'],
    ['الفوترة والتأمين', 'الفواتير، المدفوعات، بيانات الوثيقة، التشخيص والخدمات للمطالبة', 'التحصيل ومطالبات التأمين والفواتير الضريبية', 'تنفيذ العقد والأنظمة الضريبية', 'المدد النظامية', 'الحسابات، شركة التأمين'],
    ['التوظيف', 'بيانات التواصل، المؤهل، الخبرة، السيرة الذاتية', 'فرز المتقدمين والتوظيف', 'الموافقة', `${cv} شهرًا`, 'الموارد البشرية'],
    ['الموارد البشرية', 'الهوية، العقد، الراتب، الحساب البنكي، الحضور والموقع، الإجازات ومرفقاتها', 'إدارة العمل والرواتب والخطابات', 'عقد العمل ونظام العمل', 'مدة العمل + المدد النظامية', 'الموارد البشرية، المدير المباشر'],
    ['الإشعارات والرسائل', 'الجوال، البريد، نص الإشعار', 'تأكيد المواعيد والتذكير', 'الموافقة / تقديم الخدمة', `${s.retention_notif_days ?? 365} يومًا`, 'مزودو الرسائل'],
    ['سجل التعديلات', 'المستخدم، الوقت، الحقول المعدلة', 'الأمان والمساءلة', 'الالتزام النظامي', '5 سنوات', 'الإدارة فقط'],
  ] : [
    ['Visitor booking requests', 'Name, mobile, email, clinic/doctor, insurer, message', 'Contact and confirm the appointment', 'Consent', `${leads} months`, 'Reception'],
    ['Medical record', 'ID, date of birth, vitals, allergies, diagnoses, prescriptions, labs, reports', 'Medical care', 'Health service & health regulations', 'As health regulations require', 'Treating doctor, patient (once signed)'],
    ['Appointments & reception', 'Contact, appointments, check-in, queue number', 'Organise visits', 'Service', 'Relationship', 'Reception, doctor'],
    ['Billing & insurance', 'Invoices, payments, policy data, diagnosis & services for claims', 'Collection, insurance claims, tax invoices', 'Contract & tax law', 'Legal periods', 'Accounts, insurer'],
    ['Recruitment', 'Contact, education, experience, CV', 'Screening and hiring', 'Consent', `${cv} months`, 'HR'],
    ['Human resources', 'ID, contract, salary, bank, attendance with location, leave', 'Employment, payroll, letters', 'Employment contract & Labor Law', 'Employment + legal periods', 'HR, line manager'],
    ['Notifications & messages', 'Mobile, email, notification text', 'Confirmations and reminders', 'Consent / service', `${s.retention_notif_days ?? 365} days`, 'Messaging providers'],
    ['Audit log', 'User, time, changed fields', 'Security and accountability', 'Legal obligation', '5 years', 'Management only'],
  ];
  return rows;
}

/** Breach response steps (PDPL: notify SDAIA within 72 hours) */
export function breachPlan(locale: Locale): string[] {
  return locale === 'ar' ? [
    'الاحتواء فورًا: أوقف الحساب أو المفتاح المتأثر، وغيّر كلمات المرور ومفاتيح Supabase/Vercel عند الحاجة.',
    'التقييم: حدّد البيانات المتأثرة وعدد الأشخاص ووقت الحادثة من سجل التعديلات وسجلات الاستضافة.',
    'الإبلاغ: أبلغ الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا) خلال 72 ساعة من العلم بالحادثة عبر منصة حوكمة البيانات، مع وصف الحادثة والبيانات والإجراءات المتخذة.',
    'إشعار أصحاب البيانات المتأثرين دون تأخير إذا كانت الحادثة قد تلحق بهم ضررًا، مع توضيح ما يجب عليهم فعله.',
    'المعالجة: أصلح السبب، وأعد التحقق من الصلاحيات والنسخ الاحتياطية.',
    'التوثيق: سجّل الحادثة والقرارات والتواريخ، واحتفظ بها ضمن سجل الامتثال.',
  ] : [
    'Contain immediately: disable the affected account or key; rotate passwords and Supabase/Vercel keys if needed.',
    'Assess: identify the data, the number of people and the time of the incident from the audit log and hosting logs.',
    'Report to the Saudi Data & AI Authority (SDAIA) within 72 hours of becoming aware, through the National Data Governance Platform, describing the incident, the data and the measures taken.',
    'Notify affected people without delay if the incident may harm them, explaining what they should do.',
    'Fix the cause and re-check permissions and backups.',
    'Document the incident, decisions and dates in the compliance record.',
  ];
}
