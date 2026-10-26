/** نصوص نماذج الموقع وصفحة الوظائف */
import type { Locale } from './types';

const ar = {
  form: {
    name: 'الاسم الكامل', phone: 'رقم الجوال', email: 'البريد الإلكتروني', city: 'المدينة', date: 'التاريخ المفضل',
    time: 'الوقت المفضل', message: 'ملاحظات أو تفاصيل إضافية', optional: 'اختياري',
    times: ['صباحًا', 'ظهرًا', 'مساءً'], submit: 'إرسال الطلب', sending: 'جارٍ الإرسال…',
    consent: 'بإرسال الطلب توافق على تواصل فريق المجمع معك بخصوصه.',
    consentPre: 'قرأت ', privacyLink: 'سياسة الخصوصية', consentPost: ' وأوافق على معالجة بياناتي لغرض هذا الطلب',
    consentMarketing: 'أرغب في استلام العروض الصحية والحملات التوعوية (اختياري)',
    done: 'تم استلام طلبك', doneRef: 'رقم الطلب', doneBody: 'سيتواصل معك الفريق المختص في أقرب وقت. احتفظ برقم الطلب للمتابعة.',
    another: 'إرسال طلب آخر', phoneHint: '05xxxxxxxx',
  },
  careers: {
    title: 'انضم إلى فريقنا الطبي', body: 'نبحث عن كفاءات تشاركنا الشغف برعاية المرضى وجودة الخدمة. قدّم على الوظائف المتاحة أو سجّل في برنامج التدريب.',
    why: 'لماذا نُخبة؟', whyItems: [
      ['بيئة طبية متكاملة', 'عيادات تخصصية ونظام إلكتروني حديث يسهّل عملك اليومي'],
      ['تعلّم مستمر', 'استشاريون ذوو خبرة وبرامج تعليم طبي مستمر'],
      ['نمو مهني', 'مسارات واضحة للتطور داخل المجمع'],
    ],
    openings: 'الوظائف المتاحة', noOpenings: 'لا توجد وظائف معلنة حاليًا — يمكنك إرسال طلب عام وسنتواصل معك عند توفر فرصة مناسبة.',
    apply: 'قدّم الآن', training: 'برنامج التدريب', trainingBody: 'تدريب لطلاب وخريجي التخصصات الصحية والإدارية: التمريض، المختبرات، الاستقبال وخدمة المرضى، والفوترة الطبية.',
    trainingCta: 'سجّل في التدريب', formJob: 'طلب توظيف', formTraining: 'طلب تدريب', tabJob: 'توظيف', tabTraining: 'تدريب',
    position: 'الوظيفة', general: 'طلب عام (أي وظيفة مناسبة)', education: 'المؤهل', educationOpts: ['ثانوي', 'دبلوم', 'بكالوريوس', 'ماجستير', 'دكتوراه', 'طالب جامعي'],
    major: 'التخصص', university: 'الجامعة / الجهة التعليمية', experience: 'سنوات الخبرة', linkedin: 'رابط LinkedIn',
    cv: 'السيرة الذاتية', cvHint: 'PDF أو Word — حتى 5MB', cvChoose: 'اختر ملفًا', note: 'نبذة عنك',
    from: 'تاريخ بداية التدريب', to: 'تاريخ نهاية التدريب', uploading: 'جارٍ رفع الملف…', cvError: 'تعذر رفع الملف — تأكد أنه PDF أو Word وأقل من 5MB',
    employment: { full_time: 'دوام كامل', part_time: 'دوام جزئي', contract: 'عقد', training: 'تدريب' },
    requirements: 'المتطلبات',
  },
};

const en: typeof ar = {
  form: {
    name: 'Full name', phone: 'Mobile number', email: 'Email', city: 'City', date: 'Preferred date',
    time: 'Preferred time', message: 'Notes or details', optional: 'optional',
    times: ['Morning', 'Afternoon', 'Evening'], submit: 'Send request', sending: 'Sending…',
    consent: 'By sending this request you agree that our team may contact you about it.',
    consentPre: 'I have read the ', privacyLink: 'privacy policy', consentPost: ' and agree to my data being processed for this request',
    consentMarketing: 'Send me health offers and awareness campaigns (optional)',
    done: 'Request received', doneRef: 'Reference', doneBody: 'The relevant team will contact you shortly. Keep the reference for follow-up.',
    another: 'Send another request', phoneHint: '05xxxxxxxx',
  },
  careers: {
    title: 'Join our medical team', body: 'We look for people who share our passion for patient care and service quality. Apply for open roles or join our training programme.',
    why: 'Why Nukhba?', whyItems: [
      ['A complete medical setting', 'Specialty clinics and a modern digital system that makes daily work easier'],
      ['Continuous learning', 'Experienced consultants and CME programmes'],
      ['Career growth', 'Clear paths to grow within the center'],
    ],
    openings: 'Open positions', noOpenings: 'No positions are advertised right now — send a general application and we will contact you when a suitable role opens.',
    apply: 'Apply now', training: 'Training programme', trainingBody: 'Training for students and graduates in health and admin fields: nursing, laboratory, front desk and medical billing.',
    trainingCta: 'Apply for training', formJob: 'Job application', formTraining: 'Training application', tabJob: 'Job', tabTraining: 'Training',
    position: 'Position', general: 'General application (any suitable role)', education: 'Education', educationOpts: ['High school', 'Diploma', "Bachelor's", "Master's", 'PhD', 'University student'],
    major: 'Major', university: 'University / institution', experience: 'Years of experience', linkedin: 'LinkedIn URL',
    cv: 'CV', cvHint: 'PDF or Word — up to 5MB', cvChoose: 'Choose file', note: 'About you',
    from: 'Training start date', to: 'Training end date', uploading: 'Uploading file…', cvError: 'Could not upload — make sure it is PDF or Word under 5MB',
    employment: { full_time: 'Full time', part_time: 'Part time', contract: 'Contract', training: 'Training' },
    requirements: 'Requirements',
  },
};

export const pagesContent = (l: Locale) => (l === 'en' ? en : ar);
export type PagesContent = typeof ar;
