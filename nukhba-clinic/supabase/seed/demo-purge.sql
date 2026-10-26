-- =====================================================================
--  تنظيف بيانات العرض قبل التشغيل الفعلي
--  يحذف: كل المرضى والمواعيد والسجلات الطبية والفواتير والمدفوعات وطلبات الحجز،
--  والموظفين والحسابات التجريبية (@demo.example.com)
--  يُبقي: العيادات والأطباء (بدون حساباتهم التجريبية) وقائمة الأسعار وشركات التأمين — عدّلها بعدها من لوحة الإدارة
--  ⚠️ لا تشغّله بعد بدء استقبال مرضى حقيقيين
-- =====================================================================
do $$
begin
  delete from public.payments;
  delete from public.invoice_items;
  delete from public.invoices;
  delete from public.appointment_ratings;
  delete from public.medical_documents;
  delete from public.patient_files;
  delete from public.lab_orders;
  delete from public.prescription_items;
  delete from public.visit_private_notes;
  delete from public.visits;
  delete from public.booking_requests;
  delete from public.notifications where appointment_id is not null;
  delete from public.activity_logs;
  delete from public.appointments;
  delete from public.patients;

  -- HR demo records
  delete from public.hr_requests where employee_id in (select id from public.employees where email like '%@demo.example.com');
  delete from public.payroll_adjustments where employee_id in (select id from public.employees where email like '%@demo.example.com');
  delete from public.approval_delegations where delegator_id in (select id from public.employees where email like '%@demo.example.com')
     or delegate_id in (select id from public.employees where email like '%@demo.example.com');
  update public.departments set manager_employee_id = null where manager_employee_id in (select id from public.employees where email like '%@demo.example.com');
  update public.employees set manager_id = null where manager_id in (select id from public.employees where email like '%@demo.example.com');
  delete from public.employees where email like '%@demo.example.com';
  delete from public.payroll_runs r where not exists (select 1 from public.payroll_lines l where l.run_id = r.id);
  delete from public.job_applications where email like '%@demo.example.com';

  -- demo logins (doctors keep their profile in the doctors table, without a login)
  delete from auth.users where email like '%@demo.example.com';
  raise notice 'تم حذف بيانات العرض';
end $$;
