-- =====================================================================
--  بيانات العرض التجريبي — مجمع نُخبة الطبي
--  شغّله مرة واحدة من SQL Editor بعد ملفات migrations (آمن لإعادة التشغيل: يتوقف إن وجد البيانات)
--  كل الحسابات: <name>@demo.example.com — كلمة المرور: Demo@12345
--  للحذف قبل التشغيل الفعلي: demo-purge.sql
-- =====================================================================

create or replace function pg_temp.demo_user(p_email text, p_name text, p_role text, p_phone text)
returns uuid language plpgsql as $f$
declare v uuid;
begin
  select id into v from auth.users where email = p_email;
  if v is null then
    v := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', p_email,
      extensions.crypt('Demo@12345', extensions.gen_salt('bf')), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', p_role),
      jsonb_build_object('full_name', p_name, 'phone', p_phone), now(), now(), '', '', '', '', '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v, v::text, jsonb_build_object('sub', v::text, 'email', p_email, 'email_verified', true), 'email', now(), now(), now());
  end if;
  update public.profiles set full_name = p_name, phone = p_phone, role = p_role::public.app_role, is_active = true,
    privacy_accepted_version = coalesce((select privacy_version from public.company_settings where id = 1), '1.0'), privacy_accepted_at = now()
  where id = v;
  return v;
end $f$;

do $$
declare
  v_today date := public.riyadh_date();
  u_admin uuid; u_rec uuid; u_rec2 uuid; u_acc uuid; u_hr uuid; u_nurse uuid; u_pt uuid; u_pt2 uuid;
  c record; d record; p record; a record; s record; dx jsonb; rx jsonb; lab record; v_inv uuid; v_visit uuid; v_appt uuid;
  v_day date; v_start timestamptz; v_status text; v_r float; v_ids uuid[]; v_pid uuid; v_n int; v_lab uuid;
  v_main uuid; v_main2 uuid; v_loc uuid; dep record; e_gm uuid; e_med uuid; e_nurse uuid; e_rec uuid; e_fin uuid; e_hr uuid; e record; late int;
  first_ar text[] := array['محمد','عبدالله','فهد','سلطان','تركي','عبدالعزيز','نايف','بندر','سعود','ماجد','يزيد','راكان','أحمد','حسن','علي','وليد','هشام','مشعل','بدر','زياد'];
  first_f  text[] := array['نورة','سارة','ريم','هند','لطيفة','منيرة','جواهر','العنود','لمى','غادة','أسماء','مها','دانة','رهف','شهد','أمل','جود','ليان','حصة','وعد'];
  last_ar  text[] := array['الغامدي','الزهراني','القحطاني','الشهري','العتيبي','الحربي','المطيري','الدوسري','الشمري','العمري','باوزير','بن لادن','الجهني','السبيعي','العسيري','المالكي','الثبيتي','الأحمدي','باعشن','اليامي'];
  kids_m   text[] := array['يوسف','عمر','فارس','سلمان','تميم','إياد','نواف','حمزة'];
  kids_f   text[] := array['جنى','ميار','تالين','لين','سدرة','رزان','ديما','جوري'];
  nat      text[] := array['مصري','سوداني','يمني','أردني','باكستاني','هندي','فلبيني','سوري'];
  methods  text[] := array['mada','mada','mada','cash','card','apple_pay','apple_pay'];
begin
  if exists (select 1 from public.clinics where code = 'family') then
    raise notice 'البيانات التجريبية موجودة مسبقًا'; return;
  end if;
  perform setseed(0.42);

  -- -------------------------------------------------------------- staff accounts
  u_admin := pg_temp.demo_user('admin@demo.example.com', 'د. عبدالرحمن السليمان', 'admin', '0550000101');
  u_rec   := pg_temp.demo_user('reception@demo.example.com', 'أمل الحارثي', 'reception', '0550000102');
  u_rec2  := pg_temp.demo_user('reception2@demo.example.com', 'ماجد العنزي', 'reception', '0550000103');
  u_acc   := pg_temp.demo_user('accountant@demo.example.com', 'محمد أنور', 'accountant', '0550000104');
  u_hr    := pg_temp.demo_user('hr@demo.example.com', 'منى الحربي', 'hr', '0550000105');
  u_nurse := pg_temp.demo_user('nurse@demo.example.com', 'جيسيكا سانتوس', 'employee', '0550000106');

  update public.company_settings set notify_roles = '{patient}' where id = 1;

  -- -------------------------------------------------------------- clinics
  insert into public.clinics (code, name_ar, name_en, icon, sort, location_ar, location_en, description_ar, description_en) values
   ('family', 'طب الأسرة', 'Family Medicine', 'stethoscope', 1, 'الدور الأرضي — جناح أ', 'Ground floor — Wing A',
    'رعاية أولية شاملة لكل أفراد الأسرة: الكشف العام، الأمراض المزمنة، التطعيمات والفحوصات الدورية.',
    'Comprehensive primary care for the whole family: check-ups, chronic disease follow-up, vaccines and screening.'),
   ('internal', 'الباطنية', 'Internal Medicine', 'heart-pulse', 2, 'الدور الأول — جناح أ', 'First floor — Wing A',
    'تشخيص وعلاج أمراض الباطنة: السكري والضغط والجهاز الهضمي والغدد.',
    'Diagnosis and treatment of adult internal conditions: diabetes, hypertension, digestive and endocrine disorders.'),
   ('pediatrics', 'طب الأطفال', 'Pediatrics', 'baby', 3, 'الدور الأرضي — جناح ب', 'Ground floor — Wing B',
    'متابعة نمو الطفل من الولادة حتى المراهقة، التطعيمات، وعلاج أمراض الأطفال الشائعة.',
    'Child growth follow-up from birth to adolescence, vaccinations and treatment of common childhood illnesses.'),
   ('obgyn', 'النساء والولادة', 'Obstetrics & Gynecology', 'flower', 4, 'الدور الثاني — جناح ب', 'Second floor — Wing B',
    'متابعة الحمل والولادة، صحة المرأة، وعلاج تأخر الإنجاب واضطرابات الهرمونات.',
    'Pregnancy follow-up, women''s health, fertility care and hormonal disorders.'),
   ('dental', 'الأسنان', 'Dental', 'smile', 5, 'الدور الأول — جناح ب', 'First floor — Wing B',
    'علاج وتجميل الأسنان، التقويم، التنظيف والتبييض وزراعة الأسنان.',
    'Dental treatment and aesthetics, orthodontics, cleaning, whitening and implants.'),
   ('derma', 'الجلدية والتجميل', 'Dermatology & Aesthetics', 'sparkles', 6, 'الدور الثاني — جناح أ', 'Second floor — Wing A',
    'علاج الأمراض الجلدية والشعر والأظافر، وإجراءات التجميل غير الجراحية.',
    'Skin, hair and nail conditions, and non-surgical aesthetic procedures.'),
   ('ortho', 'العظام', 'Orthopedics', 'bone', 7, 'الدور الأول — جناح ج', 'First floor — Wing C',
    'إصابات الملاعب وآلام المفاصل والعمود الفقري وخشونة الركبة.',
    'Sports injuries, joint and spine pain, and knee osteoarthritis.'),
   ('eye', 'العيون', 'Ophthalmology', 'eye', 8, 'الدور الأرضي — جناح ج', 'Ground floor — Wing C',
    'فحص النظر، علاج أمراض العيون، وقياس النظارات والعدسات.',
    'Vision tests, eye disease treatment, glasses and contact-lens fitting.');

  -- -------------------------------------------------------------- doctors (+ logins) and weekly schedules
  -- weekday: 0 Sun … 4 Thu, 6 Sat (Friday off)
  for d in select * from (values
    ('family',     'doctor.khalid',  'د. خالد سعيد الزهراني',   'Dr. Khalid Al-Zahrani',   'consultant', 'male',   'طب الأسرة والأمراض المزمنة', 'Family medicine & chronic care', 18, 'evening'),
    ('family',     'doctor.reem',    'د. ريم عبدالله القحطاني', 'Dr. Reem Al-Qahtani',     'specialist', 'female', 'طب الأسرة', 'Family medicine', 8, 'morning'),
    ('internal',   'doctor.faisal',  'د. فيصل محمد الشهري',     'Dr. Faisal Al-Shehri',    'consultant', 'male',   'الغدد الصماء والسكري', 'Endocrinology & diabetes', 21, 'evening'),
    ('pediatrics', 'doctor.haifa',   'د. هيفاء ناصر العمري',     'Dr. Haifa Al-Omari',      'consultant', 'female', 'طب الأطفال وحديثي الولادة', 'Pediatrics & neonatology', 16, 'morning'),
    ('pediatrics', 'doctor.omar',    'د. عمر حسن باوزير',        'Dr. Omar Bawazir',        'specialist', 'male',   'طب الأطفال', 'Pediatrics', 7, 'evening'),
    ('obgyn',      'doctor.munira',  'د. منيرة سالم الدوسري',    'Dr. Munira Al-Dosari',    'consultant', 'female', 'طب الأجنة والحمل الحرج', 'Maternal-fetal medicine', 19, 'evening'),
    ('obgyn',      'doctor.lama',    'د. لمى فهد الحربي',        'Dr. Lama Al-Harbi',       'specialist', 'female', 'النساء والولادة', 'Obstetrics & gynecology', 9, 'morning'),
    ('dental',     'doctor.majed',   'د. ماجد عبدالرحمن الغامدي', 'Dr. Majed Al-Ghamdi',     'consultant', 'male',   'تقويم الأسنان', 'Orthodontics', 15, 'evening'),
    ('dental',     'doctor.nouf',    'د. نوف أحمد الشمراني',     'Dr. Nouf Al-Shamrani',    'specialist', 'female', 'تجميل الأسنان', 'Cosmetic dentistry', 6, 'morning'),
    ('dental',     'doctor.yasser',  'د. ياسر علي باعشن',        'Dr. Yasser Ba''ashen',    'gp',         'male',   'طب الأسنان العام', 'General dentistry', 4, 'evening'),
    ('derma',      'doctor.sarah',   'د. سارة محمد الجهني',      'Dr. Sarah Al-Juhani',     'consultant', 'female', 'الأمراض الجلدية والليزر', 'Dermatology & laser', 14, 'evening'),
    ('ortho',      'doctor.tariq',   'د. طارق إبراهيم الحازمي',   'Dr. Tariq Al-Hazmi',      'consultant', 'male',   'إصابات الملاعب والمفاصل', 'Sports injuries & joints', 17, 'evening'),
    ('eye',        'doctor.abeer',   'د. عبير خالد المطيري',     'Dr. Abeer Al-Mutairi',    'consultant', 'female', 'القرنية وتصحيح النظر', 'Cornea & refractive surgery', 13, 'morning')
  ) t(clinic, login, name_ar, name_en, title, gender, spec_ar, spec_en, years, shift)
  loop
    insert into public.doctors (profile_id, clinic_id, full_name_ar, full_name_en, title, gender, specialty_ar, specialty_en, years_experience,
      bio_ar, bio_en, languages, qualifications, scfhs_no, consultation_fee, follow_up_fee, slot_minutes)
    select pg_temp.demo_user(d.login || '@demo.example.com', d.name_ar, 'doctor', '05510' || lpad((abs(hashtext(d.login)) % 100000)::text, 5, '0')),
      c2.id, d.name_ar, d.name_en, d.title, d.gender, d.spec_ar, d.spec_en, d.years,
      'خبرة ' || d.years || ' عامًا في ' || d.spec_ar || '. يحرص على شرح الحالة والخطة العلاجية بوضوح ومتابعة المريض حتى التحسن.',
      d.years || ' years of experience in ' || lower(d.spec_en) || '. Explains every diagnosis and plan clearly and follows patients through recovery.',
      case when d.years > 12 then '{ar,en}'::text[] else '{ar,en}'::text[] end,
      case d.title when 'consultant' then 'البورد السعودي · زمالة تخصصية' when 'specialist' then 'البورد السعودي' else 'بكالوريوس طب وجراحة الفم والأسنان' end,
      lpad((abs(hashtext(d.login || 'scfhs')) % 100000000)::text, 8, '0'),
      case d.title when 'consultant' then 350 when 'specialist' then 250 else 150 end,
      case d.title when 'consultant' then 175 when 'specialist' then 125 else 75 end,
      case when d.clinic = 'dental' then 30 else 20 end
    from public.clinics c2 where c2.code = d.clinic
    returning id into v_pid;
    insert into public.doctor_schedules (doctor_id, weekday, start_time, end_time)
    select v_pid, w, case when d.shift = 'morning' then '09:00'::time else '16:00'::time end,
                     case when d.shift = 'morning' then '13:00'::time else '22:00'::time end
    from unnest(case when d.shift = 'morning' then array[6,0,1,2,3] else array[6,0,1,2,3,4] end) w;
    -- consultants also hold one morning clinic a week
    if d.title = 'consultant' and d.shift = 'evening' then
      insert into public.doctor_schedules (doctor_id, weekday, start_time, end_time) values (v_pid, 2, '10:00', '13:00');
    end if;
  end loop;
  -- one doctor is away next week (shows time-off handling)
  insert into public.doctor_time_off (doctor_id, from_date, to_date, reason)
  select id, v_today + 8, v_today + 12, 'مؤتمر طبي' from public.doctors where full_name_ar like 'د. طارق%';

  -- -------------------------------------------------------------- insurers & price list
  insert into public.insurance_companies (code, name_ar, name_en, coverage_percent, max_copay, requires_approval, phone) values
   ('BUPA', 'بوبا العربية', 'Bupa Arabia', 80, 75, false, '920000456'),
   ('TAWN', 'التعاونية', 'Tawuniya', 80, 75, false, '8001249990'),
   ('MEDG', 'ميدغلف', 'MedGulf', 70, 100, true, '8004413334'),
   ('RJHT', 'الراجحي تكافل', 'Al Rajhi Takaful', 80, 50, false, '8001200017'),
   ('MALA', 'ملاذ للتأمين', 'Malath Insurance', 75, 100, false, '920001500'),
   ('WALA', 'ولاء للتأمين', 'Walaa Insurance', 80, 75, true, '8001241177');

  insert into public.services (code, name_ar, name_en, kind, price, clinic_id) values
   ('LAB-CBC', 'صورة دم كاملة (CBC)', 'Complete blood count (CBC)', 'lab', 120, null),
   ('LAB-HBA1C', 'السكر التراكمي (HbA1c)', 'HbA1c', 'lab', 150, null),
   ('LAB-FBS', 'سكر صائم', 'Fasting blood sugar', 'lab', 50, null),
   ('LAB-LIPID', 'دهون الدم', 'Lipid profile', 'lab', 180, null),
   ('LAB-VITD', 'فيتامين د', 'Vitamin D', 'lab', 250, null),
   ('LAB-TSH', 'وظائف الغدة الدرقية (TSH)', 'Thyroid (TSH)', 'lab', 160, null),
   ('LAB-UA', 'تحليل بول', 'Urinalysis', 'lab', 60, null),
   ('LAB-CRP', 'بروتين سي التفاعلي (CRP)', 'C-reactive protein', 'lab', 90, null),
   ('LAB-FERR', 'مخزون الحديد', 'Ferritin', 'lab', 140, null),
   ('LAB-BHCG', 'هرمون الحمل (β-hCG)', 'β-hCG', 'lab', 110, null),
   ('RAD-CXR', 'أشعة صدر', 'Chest X-ray', 'radiology', 200, null),
   ('RAD-KNEE', 'أشعة ركبة', 'Knee X-ray', 'radiology', 220, null),
   ('RAD-USABD', 'سونار البطن', 'Abdominal ultrasound', 'radiology', 450, null),
   ('RAD-OBUS', 'سونار حمل', 'Obstetric ultrasound', 'radiology', 400, null),
   ('RAD-OPG', 'أشعة بانوراما للأسنان', 'Dental panoramic X-ray', 'radiology', 250, null),
   ('PRC-CLEAN', 'تنظيف الأسنان', 'Dental cleaning', 'procedure', 300, (select id from public.clinics where code = 'dental')),
   ('PRC-FILL', 'حشوة تجميلية', 'Composite filling', 'procedure', 400, (select id from public.clinics where code = 'dental')),
   ('PRC-WHITE', 'تبييض الأسنان', 'Teeth whitening', 'procedure', 1200, (select id from public.clinics where code = 'dental')),
   ('PRC-ECG', 'تخطيط القلب', 'ECG', 'procedure', 150, (select id from public.clinics where code = 'internal')),
   ('PRC-NEB', 'جلسة بخار', 'Nebulizer session', 'procedure', 60, (select id from public.clinics where code = 'pediatrics')),
   ('PRC-CRYO', 'كي بالتبريد', 'Cryotherapy', 'procedure', 350, (select id from public.clinics where code = 'derma')),
   ('PRC-PEEL', 'تقشير كيميائي', 'Chemical peel', 'procedure', 600, (select id from public.clinics where code = 'derma')),
   ('PRC-INJ', 'حقنة مفصل', 'Joint injection', 'procedure', 500, (select id from public.clinics where code = 'ortho')),
   ('PRC-REFR', 'قياس النظر', 'Refraction test', 'procedure', 120, (select id from public.clinics where code = 'eye')),
   ('PRC-DRESS', 'غيار جرح', 'Wound dressing', 'procedure', 80, (select id from public.clinics where code = 'family'));

  -- -------------------------------------------------------------- patients
  u_pt  := pg_temp.demo_user('patient@demo.example.com', 'محمد عبدالله الغامدي', 'patient', '0555100001');
  u_pt2 := pg_temp.demo_user('patient2@demo.example.com', 'نورة سعد القرشي', 'patient', '0555100002');
  insert into public.patients (profile_id, account_status, full_name, full_name_en, national_id, is_saudi, nationality, gender, birth_date, phone, email,
    blood_type, allergies, chronic_conditions, current_medications, insurance_company_id, insurance_member_no, insurance_class, insurance_expiry, emergency_name, emergency_phone)
  values (u_pt, 'active', 'محمد عبدالله الغامدي', 'Mohammed Al-Ghamdi', '1087654321', true, 'سعودي', 'male', v_today - 365 * 38 - 40, '0555100001', 'patient@demo.example.com',
    'O+', 'البنسلين', 'ارتفاع ضغط الدم', 'Amlodipine 5mg مرة يوميًا', (select id from public.insurance_companies where code = 'BUPA'), 'BP-77812345', 'VIP', v_today + 240,
    'عبدالله الغامدي', '0555100009')
  returning id into v_main;
  insert into public.patients (profile_id, account_status, full_name, full_name_en, national_id, is_saudi, nationality, gender, birth_date, phone, email,
    blood_type, insurance_company_id, insurance_member_no, insurance_class, insurance_expiry)
  values (u_pt2, 'active', 'نورة سعد القرشي', 'Noura Al-Qurashi', '1098765432', true, 'سعودية', 'female', v_today - 365 * 29 - 100, '0555100002', 'patient2@demo.example.com',
    'A+', (select id from public.insurance_companies where code = 'TAWN'), 'TW-55120987', 'A', v_today + 300)
  returning id into v_main2;

  for v_n in 1..420 loop
    insert into public.patients (full_name, national_id, is_saudi, nationality, gender, birth_date, phone, blood_type,
      insurance_company_id, insurance_member_no, insurance_class, insurance_expiry, allergies, chronic_conditions, created_at)
    select
      case when v_n > 340 then (case when g = 'male' then kids_m[1 + v_n % 8] else kids_f[1 + v_n % 8] end) || ' ' || first_ar[1 + (v_n * 7) % 20] || ' ' || last_ar[1 + (v_n * 3) % 20]
           else (case when g = 'male' then first_ar[1 + v_n % 20] else first_f[1 + v_n % 20] end) || ' ' || first_ar[1 + (v_n * 7) % 20] || ' ' || last_ar[1 + (v_n * 3) % 20] end,
      case when saudi then '1' else '2' end || lpad((100000000 + abs(hashtext('nid' || v_n)) % 899999999)::text, 9, '0'),
      saudi, case when saudi then (case when g = 'male' then 'سعودي' else 'سعودية' end) else nat[1 + v_n % 8] end, g,
      case when v_n > 340 then v_today - (365 * (1 + v_n % 12)) - (v_n * 11 % 300) else v_today - (365 * (19 + (v_n * 13) % 50)) - (v_n * 17 % 300) end,
      '05' || (array['0','3','4','5','6','9'])[1 + v_n % 6] || lpad((abs(hashtext('ph' || v_n)) % 10000000)::text, 7, '0'),
      (array['O+','A+','B+','O-','AB+','A-'])[1 + v_n % 6],
      case when v_n % 5 in (0, 1, 2) then (select id from public.insurance_companies order by code offset (v_n % 6) limit 1) end,
      case when v_n % 5 in (0, 1, 2) then 'MBR-' || lpad((abs(hashtext('m' || v_n)) % 100000000)::text, 8, '0') end,
      case when v_n % 5 in (0, 1, 2) then (array['A','B','C'])[1 + v_n % 3] end,
      case when v_n % 5 in (0, 1, 2) then v_today + 30 + (v_n * 23 % 400) end,
      case when v_n % 9 = 0 then 'الأسبرين' when v_n % 13 = 0 then 'المكسرات' end,
      case when v_n % 7 = 0 then 'السكري من النوع الثاني' when v_n % 11 = 0 then 'الربو' end,
      now() - make_interval(days => 5 + (v_n * 37) % 400)
    from (select case when v_n % 2 = 0 then 'female' else 'male' end g, (v_n % 5) <> 3 saudi) x;
  end loop;
  -- one insured patient's policy has lapsed (shows the expiry warning at the front desk)
  update public.patients set insurance_expiry = v_today - 12 where id = (select id from public.patients where insurance_company_id is not null and profile_id is null order by file_no limit 1);

  -- -------------------------------------------------------------- the two demo patients' own story
  -- Mohammed: 3 past visits (family, dental, internal) with labs + a sick leave, one unpaid invoice, an upcoming confirmed appointment
  for d in select dr.*, row_number() over () rn from public.doctors dr
           where dr.full_name_ar in ('د. خالد سعيد الزهراني', 'د. ماجد عبدالرحمن الغامدي', 'د. فيصل محمد الشهري') loop
    v_start := ((v_today - (60 - d.rn::int * 18)) + time '17:20') at time zone 'Asia/Riyadh';
    if extract(dow from v_start at time zone 'Asia/Riyadh') = 5 then v_start := v_start + interval '1 day'; end if;
    insert into public.appointments (patient_id, doctor_id, clinic_id, starts_at, ends_at, visit_type, source, status, reason, confirmed_at, created_at)
    values (v_main, d.id, d.clinic_id, v_start, v_start + make_interval(mins => d.slot_minutes), 'new', 'online', 'booked',
      case d.rn when 1 then 'كحة وحرارة' when 2 then 'ألم في الضرس' else 'متابعة الضغط والسكر' end, v_start - interval '2 days', v_start - interval '3 days')
    returning id into v_appt;
    update public.appointments set status = 'checked_in', checked_in_at = v_start - interval '8 min', queue_no = 3 where id = v_appt;
    update public.appointments set status = 'in_consultation', called_at = v_start + interval '4 min' where id = v_appt;
    insert into public.visits (appointment_id, patient_id, doctor_id, clinic_id, bp_systolic, bp_diastolic, pulse, temperature, spo2, weight_kg, height_cm,
      chief_complaint, history, examination, diagnosis, icd10_code, plan, patient_advice, follow_up_in_days, status, signed_at, created_at)
    values (v_appt, v_main, d.id, d.clinic_id, case d.rn when 3 then 138 else 126 end, 84, 78, case d.rn when 1 then 38.2 else 36.8 end, 97, 84.5, 176,
      case d.rn when 1 then 'كحة وحرارة منذ 3 أيام' when 2 then 'ألم في الضرس السفلي الأيمن مع الأكل البارد' else 'متابعة دورية لضغط الدم' end,
      'مريض ضغط منذ 4 سنوات على أملوديبين. حساسية من البنسلين.',
      case d.rn when 1 then 'احمرار في البلعوم وتضخم بسيط في اللوزتين، الصدر سليم.' when 2 then 'تسوس متوسط في الضرس 46 دون التهاب في العصب.' else 'الضغط مرتفع قليلًا، لا وذمة في الأطراف.' end,
      case d.rn when 1 then 'التهاب البلعوم الحاد' when 2 then 'تسوس الأسنان' else 'ارتفاع ضغط الدم الأساسي' end,
      case d.rn when 1 then 'J02.9' when 2 then 'K02.9' else 'I10' end,
      case d.rn when 1 then 'مضاد حيوي بديل للبنسلين، خافض حرارة، راحة.' when 2 then 'حشوة تجميلية في نفس الجلسة.' else 'رفع جرعة أملوديبين، تحاليل دهون وسكر تراكمي.' end,
      case d.rn when 1 then 'الراحة التامة 3 أيام، شرب السوائل الدافئة، استكمال المضاد الحيوي حتى لو تحسنت.'
               when 2 then 'تجنب الأكل على الجهة المعالجة لمدة ساعتين، واستخدام فرشاة ناعمة.'
               else 'تقليل الملح، المشي 30 دقيقة يوميًا، وقياس الضغط في المنزل وتسجيله.' end,
      case d.rn when 3 then 30 end, 'signed', v_start + interval '28 min', v_start)
    returning id into v_visit;
    update public.appointments set status = 'completed', completed_at = v_start + interval '28 min' where id = v_appt;
    if d.rn = 1 then
      insert into public.prescription_items (visit_id, drug_name, dose, frequency, duration, instructions) values
        (v_visit, 'Azithromycin 500mg', 'قرص', 'مرة يوميًا', '3 أيام', 'بديل للبنسلين بسبب الحساسية'),
        (v_visit, 'Paracetamol 500mg', 'قرصان', 'كل 8 ساعات عند الحرارة', '5 أيام', null);
      insert into public.medical_documents (visit_id, patient_id, doctor_id, kind, from_date, to_date, issued_at)
      values (v_visit, v_main, d.id, 'sick_leave', public.riyadh_date(v_start), public.riyadh_date(v_start) + 2, v_start + interval '30 min');
      insert into public.lab_orders (visit_id, patient_id, service_id, test_name, kind, status, result_text, result_flag, resulted_at)
      select v_visit, v_main, id, name_ar, kind, 'resulted', 'WBC 11.8 (مرتفع قليلًا) — يتوافق مع التهاب بكتيري. باقي المؤشرات طبيعية.', 'abnormal', v_start + interval '1 day'
      from public.services where code = 'LAB-CBC';
    elsif d.rn = 2 then
      insert into public.prescription_items (visit_id, drug_name, dose, frequency, duration) values
        (v_visit, 'Ibuprofen 400mg', 'قرص', 'كل 8 ساعات بعد الأكل', '3 أيام');
      insert into public.invoice_items (invoice_id, service_id, description, unit_price)
      select i.id, s2.id, s2.name_ar, s2.price from public.invoices i, public.services s2 where i.appointment_id = v_appt and s2.code = 'PRC-FILL';
    else
      insert into public.prescription_items (visit_id, drug_name, dose, frequency, duration, instructions) values
        (v_visit, 'Amlodipine 10mg', 'قرص', 'مرة يوميًا صباحًا', '3 أشهر', 'بدلًا من 5mg');
      insert into public.lab_orders (visit_id, patient_id, service_id, test_name, kind, status, result_text, result_flag, resulted_at)
      select v_visit, v_main, id, name_ar, kind, 'resulted',
        case code when 'LAB-LIPID' then 'LDL 162 mg/dL (مرتفع) · HDL 41 · الدهون الثلاثية 190' else 'HbA1c 5.9% — ما قبل السكري' end,
        'abnormal', v_start + interval '1 day'
      from public.services where code in ('LAB-LIPID', 'LAB-HBA1C');
    end if;
    select id into v_inv from public.invoices where appointment_id = v_appt;
    update public.invoices set status = 'issued', issued_at = v_start + interval '30 min', created_at = v_start, approval_no = 'APR-' || (400000 + d.rn) where id = v_inv;
    perform public._recalc_invoice(v_inv);
    if d.rn <> 2 then
      insert into public.payments (invoice_id, amount, method, received_by, received_at)
      select v_inv, patient_amount, 'mada', u_rec, v_start + interval '35 min' from public.invoices where id = v_inv and patient_amount > 0;
      perform public._recalc_invoice(v_inv);
      update public.invoices set claim_status = 'paid', claim_submitted_at = v_start + interval '3 days', claim_approved_amount = insurance_amount,
        claim_paid_at = v_start + interval '28 days' where id = v_inv;
    end if;
    insert into public.appointment_ratings (appointment_id, patient_id, doctor_id, score, comment, created_at)
    select v_appt, v_main, d.id, 5, 'شرح ممتاز واهتمام بالتفاصيل', v_start + interval '5 hours' where d.rn = 1;
  end loop;
  -- his follow-up with internal medicine, booked for the day after tomorrow (or the next working day)
  select dr.* into d from public.doctors dr where dr.full_name_ar = 'د. فيصل محمد الشهري';
  select st into v_start from (
    select s2.starts_at st from generate_series(v_today + 2, v_today + 9, interval '1 day') dd
    cross join lateral public.available_slots(d.id, dd::date) s2 where s2.is_free order by 1 offset 2 limit 1) z;
  if v_start is not null then
    insert into public.appointments (patient_id, doctor_id, clinic_id, starts_at, ends_at, visit_type, source, status, reason, confirmed_at)
    values (v_main, d.id, d.clinic_id, v_start, v_start + make_interval(mins => d.slot_minutes), 'follow_up', 'online', 'confirmed',
            'متابعة الضغط بعد تعديل الجرعة', now());
  end if;

  -- Noura: an OB/GYN visit last week and a dental appointment next week
  select dr.* into d from public.doctors dr where dr.full_name_ar = 'د. لمى فهد الحربي';
  v_start := ((v_today - 6) + time '10:20') at time zone 'Asia/Riyadh';
  if extract(dow from v_today - 6) in (4, 5) then v_start := v_start - interval '2 days'; end if;
  insert into public.appointments (patient_id, doctor_id, clinic_id, starts_at, ends_at, visit_type, source, status, confirmed_at)
  values (v_main2, d.id, d.clinic_id, v_start, v_start + interval '20 min', 'new', 'online', 'booked', v_start - interval '1 day')
  returning id into v_appt;
  update public.appointments set status = 'checked_in', checked_in_at = v_start - interval '6 min', queue_no = 2 where id = v_appt;
  update public.appointments set status = 'in_consultation', called_at = v_start + interval '2 min' where id = v_appt;
  insert into public.visits (appointment_id, patient_id, doctor_id, clinic_id, bp_systolic, bp_diastolic, pulse, temperature, weight_kg,
    chief_complaint, diagnosis, icd10_code, plan, patient_advice, follow_up_in_days, status, signed_at, created_at)
  values (v_appt, v_main2, d.id, d.clinic_id, 112, 72, 80, 36.7, 63.2, 'اضطراب في مواعيد الدورة', 'اضطراب الدورة الشهرية', 'N92.6',
    'تحاليل هرمونية وسونار، والمتابعة بالنتائج.', 'تنظيم النوم والغذاء، وتسجيل مواعيد الدورة في تطبيق للمتابعة.', 30, 'signed', v_start + interval '25 min', v_start)
  returning id into v_visit;
  update public.appointments set status = 'completed', completed_at = v_start + interval '25 min' where id = v_appt;
  insert into public.lab_orders (visit_id, patient_id, service_id, test_name, kind, status, result_text, result_flag, resulted_at)
  select v_visit, v_main2, id, name_ar, kind, 'resulted', 'TSH 2.1 mIU/L — طبيعي', 'normal', v_start + interval '1 day' from public.services where code = 'LAB-TSH';
  insert into public.lab_orders (visit_id, patient_id, service_id, test_name, kind, status)
  select v_visit, v_main2, id, name_ar, kind, 'ordered' from public.services where code = 'RAD-USABD';
  select id into v_inv from public.invoices where appointment_id = v_appt;
  update public.invoices set status = 'issued', issued_at = v_start + interval '30 min', created_at = v_start where id = v_inv;
  perform public._recalc_invoice(v_inv);
  insert into public.payments (invoice_id, amount, method, received_by, received_at)
  select v_inv, patient_amount, 'apple_pay', u_rec2, v_start + interval '32 min' from public.invoices where id = v_inv and patient_amount > 0;
  perform public._recalc_invoice(v_inv);

  -- -------------------------------------------------------------- 60 days of history
  for v_day in select g::date from generate_series(v_today - 60, v_today + 14, interval '1 day') g loop
    continue when extract(dow from v_day) = 5;
    for d in select dr.*, cl.code as clinic_code from public.doctors dr join public.clinics cl on cl.id = dr.clinic_id loop
      continue when exists (select 1 from public.doctor_time_off t where t.doctor_id = d.id and v_day between t.from_date and t.to_date);
      for s in
        select gs as st from public.doctor_schedules sc
        cross join lateral generate_series((v_day + sc.start_time) at time zone 'Asia/Riyadh',
                                           (v_day + sc.end_time) at time zone 'Asia/Riyadh' - make_interval(mins => d.slot_minutes),
                                           make_interval(mins => d.slot_minutes)) gs
        where sc.doctor_id = d.id and sc.weekday = extract(dow from v_day)::int
          and not exists (select 1 from public.appointments x where x.doctor_id = d.id and x.starts_at = gs)
          and random() < case when v_day < v_today then 0.42 when v_day = v_today then 0.5 else 0.30 - (v_day - v_today) * 0.014 end
        order by gs
      loop
        -- who: children for pediatrics, women for OB/GYN, adults elsewhere
        select id into v_pid from public.patients
        where profile_id is null
          and case d.clinic_code when 'pediatrics' then birth_date > v_today - 365 * 14
                                 when 'obgyn' then gender = 'female' and birth_date < v_today - 365 * 18
                                 else birth_date < v_today - 365 * 14 end
        order by random() limit 1;

        v_r := random();
        v_status := case
          when s.st > now() + interval '30 min' then (case when v_r < 0.45 then 'confirmed' else 'booked' end)
          when v_day < v_today then (case when v_r < 0.80 then 'completed' when v_r < 0.89 then 'no_show' else 'cancelled' end)
          -- today, already started or about to
          when s.st < now() - interval '50 min' then (case when v_r < 0.88 then 'completed' else 'no_show' end)
          when s.st < now() - interval '20 min' then 'in_consultation'
          else (case when v_r < 0.75 then 'checked_in' else 'confirmed' end) end;

        insert into public.appointments (patient_id, doctor_id, clinic_id, starts_at, ends_at, visit_type, source, status, reason,
          confirmed_at, created_at, cancel_reason, cancelled_at, reminder_sent_at)
        values (v_pid, d.id, d.clinic_id, s.st, s.st + make_interval(mins => d.slot_minutes),
          case when random() < 0.3 then 'follow_up' else 'new' end,
          (array['online','online','reception','phone','reception','website'])[1 + floor(random() * 6)::int],
          'booked',
          (array[null, 'متابعة', 'ألم مستمر منذ أيام', 'فحص دوري', 'استشارة', null])[1 + floor(random() * 6)::int],
          case when v_status <> 'booked' then s.st - interval '1 day' end,
          s.st - make_interval(days => 1 + floor(random() * 10)::int),
          case when v_status = 'cancelled' then (array['ظرف طارئ','تحسنت الحالة','تعارض مع موعد عمل'])[1 + floor(random() * 3)::int] end,
          case when v_status = 'cancelled' then s.st - interval '5 hours' end,
          case when v_day <= v_today then s.st - interval '1 day' end)
        returning * into a;

        if v_status in ('completed', 'in_consultation', 'checked_in') then
          -- arrival (opens the invoice through the billing trigger)
          update public.appointments set status = 'checked_in', checked_in_at = s.st - make_interval(mins => 5 + floor(random() * 15)::int),
            queue_no = (select coalesce(max(queue_no), 0) + 1 from public.appointments x where x.doctor_id = d.id and public.riyadh_date(x.starts_at) = v_day)
          where id = a.id;
        end if;
        if v_status in ('completed', 'in_consultation') then
          update public.appointments set status = 'in_consultation', called_at = s.st + make_interval(mins => floor(random() * 22)::int) where id = a.id;
          dx := (select x from jsonb_array_elements(case d.clinic_code
              when 'family' then '[{"d":"التهاب البلعوم الحاد","c":"J02.9"},{"d":"عدوى الجهاز التنفسي العلوي","c":"J06.9"},{"d":"ارتفاع ضغط الدم الأساسي","c":"I10"},{"d":"داء السكري من النوع الثاني","c":"E11.9"},{"d":"نقص فيتامين د","c":"E55.9"},{"d":"صداع توتري","c":"G44.2"}]'::jsonb
              when 'internal' then '[{"d":"ارتفاع ضغط الدم الأساسي","c":"I10"},{"d":"داء السكري من النوع الثاني","c":"E11.9"},{"d":"ارتفاع الدهون في الدم","c":"E78.5"},{"d":"ارتجاع المريء","c":"K21.9"},{"d":"القولون العصبي","c":"K58.9"}]'::jsonb
              when 'pediatrics' then '[{"d":"التهاب الأذن الوسطى","c":"H66.9"},{"d":"عدوى الجهاز التنفسي العلوي","c":"J06.9"},{"d":"نزلة معوية","c":"A09"},{"d":"ربو الأطفال","c":"J45.9"},{"d":"فحص نمو دوري","c":"Z00.1"}]'::jsonb
              when 'obgyn' then '[{"d":"متابعة حمل طبيعي","c":"Z34.9"},{"d":"التهاب المسالك البولية","c":"N39.0"},{"d":"تكيس المبايض","c":"E28.2"},{"d":"اضطراب الدورة الشهرية","c":"N92.6"}]'::jsonb
              when 'dental' then '[{"d":"تسوس الأسنان","c":"K02.9"},{"d":"التهاب اللثة المزمن","c":"K05.1"},{"d":"فحص وتنظيف وقائي","c":"Z01.2"},{"d":"سوء إطباق — تقويم","c":"K07.4"}]'::jsonb
              when 'derma' then '[{"d":"حب الشباب","c":"L70.0"},{"d":"الأكزيما","c":"L30.9"},{"d":"الصدفية","c":"L40.9"},{"d":"تساقط الشعر","c":"L65.9"},{"d":"الكلف","c":"L81.1"}]'::jsonb
              when 'ortho' then '[{"d":"آلام أسفل الظهر","c":"M54.5"},{"d":"خشونة الركبة","c":"M17.9"},{"d":"التواء الكاحل","c":"S93.4"},{"d":"التهاب الأوتار","c":"M77.9"}]'::jsonb
              else '[{"d":"قصر النظر","c":"H52.1"},{"d":"التهاب الملتحمة","c":"H10.9"},{"d":"جفاف العين","c":"H04.1"},{"d":"فحص نظر دوري","c":"Z01.0"}]'::jsonb end) x
            order by random() limit 1);
          insert into public.visits (appointment_id, patient_id, doctor_id, clinic_id, bp_systolic, bp_diastolic, pulse, temperature, spo2, weight_kg, height_cm,
            chief_complaint, examination, diagnosis, icd10_code, plan, patient_advice, follow_up_in_days, status, signed_at, created_at)
          values (a.id, v_pid, d.id, d.clinic_id, 110 + floor(random() * 35)::int, 70 + floor(random() * 18)::int, 64 + floor(random() * 30)::int,
            round((36.5 + random() * 1.4)::numeric, 1), 95 + floor(random() * 5)::int, round((55 + random() * 45)::numeric, 1), round((150 + random() * 35)::numeric, 1),
            case when v_status = 'completed' then coalesce(a.reason, 'مراجعة') end,
            case when v_status = 'completed' then 'الحالة العامة مستقرة، لا توجد علامات خطورة.' end,
            case when v_status = 'completed' then dx ->> 'd' end, case when v_status = 'completed' then dx ->> 'c' end,
            case when v_status = 'completed' then 'العلاج الموضح في الوصفة والمتابعة حسب الحاجة.' end,
            case when v_status = 'completed' then 'الالتزام بالعلاج في مواعيده، وشرب كمية كافية من الماء، ومراجعة الطوارئ عند تفاقم الأعراض.' end,
            case when v_status = 'completed' and random() < 0.4 then (array[7,14,30,90])[1 + floor(random() * 4)::int] end,
            case when v_status = 'completed' then 'signed' else 'open' end,
            case when v_status = 'completed' then s.st + interval '25 min' end, s.st)
          returning id into v_visit;

          if v_status = 'completed' then
            update public.appointments set status = 'completed', completed_at = s.st + interval '25 min' where id = a.id;
            -- prescription
            for rx in select x from jsonb_array_elements(case d.clinic_code
                when 'family' then '[{"n":"Paracetamol 500mg","d":"قرصان","f":"كل 8 ساعات عند الحاجة","t":"5 أيام"},{"n":"Amoxicillin 500mg","d":"كبسولة","f":"3 مرات يوميًا","t":"7 أيام"},{"n":"Vitamin D3 50,000 IU","d":"كبسولة","f":"مرة أسبوعيًا","t":"8 أسابيع"}]'::jsonb
                when 'internal' then '[{"n":"Metformin 500mg","d":"قرص","f":"مرتين يوميًا مع الأكل","t":"3 أشهر"},{"n":"Amlodipine 5mg","d":"قرص","f":"مرة يوميًا","t":"3 أشهر"},{"n":"Omeprazole 20mg","d":"كبسولة","f":"قبل الإفطار","t":"4 أسابيع"}]'::jsonb
                when 'pediatrics' then '[{"n":"Paracetamol Syrup 120mg/5ml","d":"5 مل","f":"كل 6 ساعات عند الحرارة","t":"3 أيام"},{"n":"Amoxicillin Susp 250mg/5ml","d":"5 مل","f":"3 مرات يوميًا","t":"7 أيام"},{"n":"ORS","d":"ظرف","f":"بعد كل إسهال","t":"3 أيام"}]'::jsonb
                when 'obgyn' then '[{"n":"Folic Acid 5mg","d":"قرص","f":"مرة يوميًا","t":"3 أشهر"},{"n":"Ferrous Sulfate 200mg","d":"قرص","f":"مرة يوميًا","t":"شهرين"},{"n":"Nitrofurantoin 100mg","d":"كبسولة","f":"مرتين يوميًا","t":"5 أيام"}]'::jsonb
                when 'dental' then '[{"n":"Ibuprofen 400mg","d":"قرص","f":"كل 8 ساعات بعد الأكل","t":"3 أيام"},{"n":"Chlorhexidine Mouthwash 0.12%","d":"15 مل","f":"مرتين يوميًا","t":"أسبوعين"}]'::jsonb
                when 'derma' then '[{"n":"Adapalene Gel 0.1%","d":"طبقة رقيقة","f":"مساءً","t":"3 أشهر"},{"n":"Hydrocortisone Cream 1%","d":"طبقة رقيقة","f":"مرتين يوميًا","t":"أسبوع"},{"n":"Sunscreen SPF 50","d":"—","f":"كل 3 ساعات نهارًا","t":"مستمر"}]'::jsonb
                when 'ortho' then '[{"n":"Diclofenac 50mg","d":"قرص","f":"مرتين يوميًا بعد الأكل","t":"7 أيام"},{"n":"Diclofenac Gel 1%","d":"دهان","f":"3 مرات يوميًا","t":"أسبوعين"}]'::jsonb
                else '[{"n":"Artificial Tears","d":"قطرة","f":"4 مرات يوميًا","t":"شهر"},{"n":"Tobramycin Eye Drops","d":"قطرة","f":"كل 6 ساعات","t":"7 أيام"}]'::jsonb end) x
              order by random() limit 1 + floor(random() * 2)::int
            loop
              insert into public.prescription_items (visit_id, drug_name, dose, frequency, duration, created_at)
              values (v_visit, rx ->> 'n', rx ->> 'd', rx ->> 'f', rx ->> 't', s.st + interval '20 min');
            end loop;
          end if;

          -- tests (billed automatically on the visit invoice)
          if random() < 0.35 then
            for lab in select * from public.services where kind in ('lab', 'radiology') and code = any(case d.clinic_code
                when 'family' then array['LAB-CBC','LAB-VITD','LAB-FBS','RAD-CXR'] when 'internal' then array['LAB-HBA1C','LAB-LIPID','LAB-TSH','RAD-USABD']
                when 'pediatrics' then array['LAB-CBC','LAB-CRP','LAB-UA'] when 'obgyn' then array['LAB-BHCG','RAD-OBUS','LAB-UA','LAB-FERR']
                when 'dental' then array['RAD-OPG'] when 'derma' then array['LAB-FERR','LAB-VITD'] when 'ortho' then array['RAD-KNEE','LAB-CRP']
                else array['LAB-FBS'] end) order by random() limit 1 + floor(random() * 2)::int
            loop
              insert into public.lab_orders (visit_id, patient_id, service_id, test_name, kind, status, result_text, result_flag, resulted_at, created_at)
              values (v_visit, v_pid, lab.id, lab.name_ar, lab.kind,
                case when v_status = 'completed' and v_day < v_today - 1 then 'resulted' else 'ordered' end,
                case when v_status = 'completed' and v_day < v_today - 1 then
                  case lab.kind when 'radiology' then 'لا توجد تغيرات مرضية واضحة. يُنصح بالمتابعة السريرية.' else 'النتائج ضمن المعدل الطبيعي.' end end,
                case when v_status = 'completed' and v_day < v_today - 1 then (case when random() < 0.82 then 'normal' else 'abnormal' end) end,
                case when v_status = 'completed' and v_day < v_today - 1 then s.st + interval '1 day' end, s.st + interval '15 min');
            end loop;
          end if;

          if v_status = 'completed' then
            -- sick leave now and then
            if random() < 0.08 then
              insert into public.medical_documents (visit_id, patient_id, doctor_id, kind, from_date, to_date, issued_at)
              values (v_visit, v_pid, d.id, 'sick_leave', v_day, v_day + floor(random() * 3)::int, s.st + interval '25 min');
            end if;
            -- billing: issue, pay the patient share, age the claim
            select id into v_inv from public.invoices where appointment_id = a.id;
            update public.invoices set status = 'issued', issued_at = s.st + interval '30 min', created_at = s.st,
              approval_no = case when payer = 'insurance' then 'APR-' || floor(random() * 900000 + 100000)::int end where id = v_inv;
            perform public._recalc_invoice(v_inv);
            insert into public.payments (invoice_id, amount, method, received_by, received_at)
            select v_inv, patient_amount, methods[1 + floor(random() * 7)::int], (array[u_rec, u_rec2])[1 + floor(random() * 2)::int], s.st + interval '35 min'
            from public.invoices where id = v_inv and patient_amount > 0;
            perform public._recalc_invoice(v_inv);
            update public.invoices i set
              claim_status = case when payer <> 'insurance' then 'none'
                                  when v_day < v_today - 35 then (array['paid','paid','paid','approved','partially_approved','rejected'])[1 + floor(random() * 6)::int]
                                  when v_day < v_today - 10 then (array['submitted','submitted','approved'])[1 + floor(random() * 3)::int]
                                  else 'pending' end,
              claim_submitted_at = case when payer = 'insurance' and v_day < v_today - 10 then s.st + interval '5 days' end
            where id = v_inv;
            update public.invoices set
              claim_approved_amount = case claim_status when 'paid' then insurance_amount when 'approved' then insurance_amount
                                                        when 'partially_approved' then round(insurance_amount * 0.85, 2) when 'rejected' then 0 end,
              claim_paid_at = case when claim_status = 'paid' then created_at + interval '30 days' end,
              claim_note = case when claim_status = 'rejected' then 'الخدمة غير مشمولة في فئة الوثيقة'
                                when claim_status = 'partially_approved' then 'خصم بند الأدوية حسب جدول المنافع' end
            where id = v_inv;
            -- rating
            if random() < 0.55 then
              insert into public.appointment_ratings (appointment_id, patient_id, doctor_id, score, comment, created_at)
              values (a.id, v_pid, d.id, (array[5,5,5,5,4,4,4,3,5,2])[1 + floor(random() * 10)::int],
                (array[null, 'الدكتور متعاون وشرح الحالة بوضوح', 'تنظيم ممتاز وانتظار قصير', null, 'تعامل راقٍ من الاستقبال', null])[1 + floor(random() * 6)::int],
                s.st + interval '3 hours');
            end if;
          end if;
        elsif v_status in ('no_show', 'cancelled', 'confirmed') then
          update public.appointments set status = v_status::public.appointment_status where id = a.id;
        end if;
      end loop;
    end loop;
  end loop;

  -- -------------------------------------------------------------- website booking requests
  insert into public.booking_requests (full_name, phone, email, clinic_id, doctor_id, preferred_date, preferred_time, insurance_name, message, status, created_at) values
   ('عبدالله الشريف', '0561234501', null, (select id from public.clinics where code = 'dental'), (select id from public.doctors where full_name_ar like 'د. ماجد%'),
    v_today + 2, 'evening', 'بوبا', 'أرغب في استشارة تقويم لابني 13 سنة', 'new', now() - interval '35 min'),
   ('هيا العتيبي', '0569876502', 'haya@example.com', (select id from public.clinics where code = 'derma'), null,
    v_today + 1, 'any', null, 'جلسة تقشير', 'new', now() - interval '2 hours'),
   ('سامي بخاري', '0543210903', null, (select id from public.clinics where code = 'ortho'), null,
    v_today + 3, 'evening', 'التعاونية', 'ألم في الركبة بعد الجري', 'contacted', now() - interval '1 day'),
   ('أم فيصل', '0501112204', null, (select id from public.clinics where code = 'pediatrics'), (select id from public.doctors where full_name_ar like 'د. هيفاء%'),
    v_today + 1, 'morning', null, 'تطعيمات 4 أشهر', 'new', now() - interval '20 min');

  -- -------------------------------------------------------------- HR: structure, employees, salaries, attendance
  insert into public.work_locations (name, lat, lng, radius_m) values ('مجمع نُخبة الطبي — جدة', 21.5637, 39.1500, 200) returning id into v_loc;
  insert into public.departments (name) values ('الإدارة العامة');
  insert into public.departments (name, parent_id) select x, (select id from public.departments where name = 'الإدارة العامة')
  from unnest(array['الشؤون الطبية', 'التمريض', 'الاستقبال وخدمة المرضى', 'المالية والتأمين', 'الموارد البشرية']) x;

  insert into public.employees (profile_id, full_name, email, phone, job_title, department_id, nationality_type, nationality, gender, hire_date, annual_leave_days, work_location_id, remote_allowed, work_start, work_end)
  values (u_admin, 'د. عبدالرحمن السليمان', 'admin@demo.example.com', '0550000101', 'المدير العام', (select id from public.departments where name = 'الإدارة العامة'),
    'saudi', 'سعودي', 'male', v_today - 3000, 30, v_loc, true, '09:00', '17:00') returning id into e_gm;
  insert into public.employees (profile_id, full_name, email, phone, job_title, department_id, manager_id, nationality_type, nationality, gender, hire_date, work_location_id, work_start, work_end)
  select dr.profile_id, dr.full_name_ar, p2.email, p2.phone,
    case dr.title when 'consultant' then 'استشاري ' when 'specialist' then 'أخصائي ' else 'طبيب عام ' end || c2.name_ar,
    (select id from public.departments where name = 'الشؤون الطبية'), e_gm, 'saudi', case dr.gender when 'male' then 'سعودي' else 'سعودية' end, dr.gender,
    v_today - (400 + abs(hashtext(dr.full_name_ar)) % 2000), v_loc,
    (select min(start_time) from public.doctor_schedules where doctor_id = dr.id), (select max(end_time) from public.doctor_schedules where doctor_id = dr.id)
  from public.doctors dr join public.clinics c2 on c2.id = dr.clinic_id join public.profiles p2 on p2.id = dr.profile_id;
  -- the family-medicine consultant is also medical director
  select id into e_med from public.employees where full_name = 'د. خالد سعيد الزهراني';
  update public.employees set job_title = 'المدير الطبي — استشاري طب الأسرة' where id = e_med;
  update public.employees set manager_id = e_med where department_id = (select id from public.departments where name = 'الشؤون الطبية') and id <> e_med;
  insert into public.employees (profile_id, full_name, email, phone, job_title, department_id, manager_id, nationality_type, nationality, gender, hire_date, work_location_id, work_start, work_end)
  values (u_nurse, 'جيسيكا سانتوس', 'nurse@demo.example.com', '0550000106', 'رئيسة التمريض', (select id from public.departments where name = 'التمريض'), e_med,
    'resident', 'فلبينية', 'female', v_today - 1400, v_loc, '08:00', '16:00') returning id into e_nurse;
  insert into public.employees (full_name, email, phone, job_title, department_id, manager_id, nationality_type, nationality, gender, hire_date, work_location_id, work_start, work_end)
  values ('ماريا كروز', 'nurse.maria@demo.example.com', '0550000116', 'ممرضة', (select id from public.departments where name = 'التمريض'), e_nurse, 'resident', 'فلبينية', 'female', v_today - 700, v_loc, '08:00', '16:00'),
         ('رنا الصاعدي', 'nurse.rana@demo.example.com', '0550000117', 'ممرضة', (select id from public.departments where name = 'التمريض'), e_nurse, 'saudi', 'سعودية', 'female', v_today - 500, v_loc, '15:00', '23:00'),
         ('أنيتا جوزيف', 'nurse.anita@demo.example.com', '0550000118', 'ممرضة', (select id from public.departments where name = 'التمريض'), e_nurse, 'resident', 'هندية', 'female', v_today - 900, v_loc, '15:00', '23:00');
  insert into public.employees (profile_id, full_name, email, phone, job_title, department_id, manager_id, nationality_type, nationality, gender, hire_date, work_location_id, work_start, work_end)
  values (u_rec, 'أمل الحارثي', 'reception@demo.example.com', '0550000102', 'مشرفة الاستقبال', (select id from public.departments where name = 'الاستقبال وخدمة المرضى'), e_gm,
    'saudi', 'سعودية', 'female', v_today - 1200, v_loc, '08:30', '16:30') returning id into e_rec;
  insert into public.employees (profile_id, full_name, email, phone, job_title, department_id, manager_id, nationality_type, nationality, gender, hire_date, work_location_id, work_start, work_end)
  values (u_rec2, 'ماجد العنزي', 'reception2@demo.example.com', '0550000103', 'موظف استقبال', (select id from public.departments where name = 'الاستقبال وخدمة المرضى'), e_rec,
    'saudi', 'سعودي', 'male', v_today - 450, v_loc, '15:00', '23:00');
  insert into public.employees (profile_id, full_name, email, phone, job_title, department_id, manager_id, nationality_type, nationality, gender, hire_date, contract_type, contract_end, work_location_id)
  values (u_acc, 'محمد أنور', 'accountant@demo.example.com', '0550000104', 'محاسب ومسؤول مطالبات التأمين', (select id from public.departments where name = 'المالية والتأمين'), e_gm,
    'resident', 'مصري', 'male', v_today - 800, 'fixed', v_today + 45, v_loc) returning id into e_fin;
  insert into public.employees (profile_id, full_name, email, phone, job_title, department_id, manager_id, nationality_type, nationality, gender, hire_date, work_location_id)
  values (u_hr, 'منى الحربي', 'hr@demo.example.com', '0550000105', 'مديرة الموارد البشرية', (select id from public.departments where name = 'الموارد البشرية'), e_gm,
    'saudi', 'سعودية', 'female', v_today - 1600, v_loc) returning id into e_hr;
  update public.departments set manager_employee_id = e_gm where name = 'الإدارة العامة';
  update public.departments set manager_employee_id = e_med where name = 'الشؤون الطبية';
  update public.departments set manager_employee_id = e_nurse where name = 'التمريض';
  update public.departments set manager_employee_id = e_rec where name = 'الاستقبال وخدمة المرضى';
  update public.departments set manager_employee_id = e_fin where name = 'المالية والتأمين';
  update public.departments set manager_employee_id = e_hr where name = 'الموارد البشرية';

  for e in select id, job_title, nationality_type from public.employees where email like '%@demo.example.com' loop
    insert into public.employee_salaries (employee_id, basic, housing, transport)
    values (e.id, case when e.job_title like 'المدير العام%' then 35000 when e.job_title like 'المدير الطبي%' then 32000
                       when e.job_title like 'استشاري%' then 28000 when e.job_title like 'أخصائي%' then 18000 when e.job_title like 'طبيب عام%' then 12000
                       when e.job_title like 'رئيسة التمريض' then 11000 when e.job_title = 'ممرضة' then 7000 when e.job_title like 'مديرة%' then 15000
                       when e.job_title like 'محاسب%' then 9000 when e.job_title like 'مشرفة%' then 8000 else 6000 end, 0, 0)
    on conflict (employee_id) do nothing;
    insert into public.employee_private (employee_id, id_number, id_expiry, iban, bank_name)
    values (e.id, case when e.nationality_type = 'saudi' then '10' else '24' end || lpad((abs(hashtext(e.id::text)) % 100000000)::text, 8, '0'),
      v_today + 200 + (abs(hashtext(e.id::text)) % 500),
      'SA' || lpad((abs(hashtext(e.id::text || 'iban')) % 100)::text, 2, '0') || '80000000' || lpad((abs(hashtext(e.id::text || 'acc')) % 1000000000000)::text, 14, '0'),
      (array['مصرف الراجحي', 'البنك الأهلي السعودي', 'بنك الرياض', 'مصرف الإنماء'])[1 + abs(hashtext(e.id::text)) % 4])
    on conflict (employee_id) do nothing;
  end loop;
  update public.employee_salaries sal set housing = round(basic * 0.25), transport = round(basic * 0.10)
  from public.employees x where x.id = sal.employee_id and x.email like '%@demo.example.com';
  update public.employee_private set id_expiry = v_today + 25 where employee_id = e_fin;

  for e in select x.id, x.email, x.work_start ws from public.employees x where x.email like '%@demo.example.com' and x.id <> e_gm loop
    for v_day in select g::date from generate_series(date_trunc('month', v_today)::date, v_today, interval '1 day') g loop
      continue when extract(isodow from v_day) = 5 or public.holidays_between(v_day, v_day) > 0;
      continue when e.email = 'nurse.anita@demo.example.com' and v_day = date_trunc('month', v_today)::date + 6;
      continue when e.ws + interval '20 min' > (now() at time zone 'Asia/Riyadh')::time and v_day = v_today;
      late := case when e.email = 'reception2@demo.example.com' and extract(day from v_day)::int % 4 = 0 then 22 + (abs(hashtext(e.email || v_day)) % 20)
                   else -10 + (abs(hashtext(e.email || v_day)) % 22) end;
      insert into public.attendance (employee_id, work_date, check_in_at, check_out_at, in_lat, in_lng, in_distance_m, location_id, source)
      values (e.id, v_day, (v_day + e.ws + make_interval(mins => late)) at time zone 'Asia/Riyadh',
        case when v_day = v_today then null else (v_day + e.ws + interval '8 hours' + make_interval(mins => abs(hashtext(e.email || v_day || 'o')) % 40)) at time zone 'Asia/Riyadh' end,
        21.5637 + ((abs(hashtext(e.email || v_day)) % 10) - 5) * 0.00008, 39.1500, abs(hashtext(e.email || v_day)) % 140, v_loc, 'gps')
      on conflict (employee_id, work_date) do nothing;
    end loop;
  end loop;

  raise notice 'تمت إضافة البيانات التجريبية';
end $$;

select (select count(*) from public.patients) as patients, (select count(*) from public.appointments) as appointments,
       (select count(*) from public.visits) as visits, (select count(*) from public.invoices) as invoices,
       (select count(*) from public.employees) as employees;
