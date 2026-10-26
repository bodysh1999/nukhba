-- =====================================================================
--  تقوية الأمان (Supabase Security Advisor): دوال الصلاحيات والمشغلات غير متاحة للزائر،
--  وتثبيت search_path للدوال المساعدة. آمن لإعادة التشغيل.
-- =====================================================================
alter function public.distance_m(double precision, double precision, double precision, double precision) set search_path = public;
alter function public.today_riyadh() set search_path = public;

revoke execute on function public.my_employee_id(), public.can_view_employee(uuid), public.can_view_hr_request(uuid), public.manager_chain(uuid)
  from public, anon;
grant execute on function public.my_employee_id(), public.can_view_employee(uuid), public.can_view_hr_request(uuid) to authenticated;
revoke execute on function public.manager_chain(uuid) from authenticated;
revoke execute on function public.guard_self_hr_edit() from public, anon, authenticated;

revoke execute on function public.can_decide_hr_request(uuid), public.holidays_between(date, date), public.leave_calendar(date, date),
  public.resolve_error(text), public.system_health(), public.delegation_candidates(), public.my_acting_for(),
  public.set_delegation(uuid, date, date, text, uuid), public.cancel_delegation(uuid) from anon, public;
revoke execute on function public.escalate_hr_approvals(), public.attendance_alerts_run() from anon, authenticated, public;
grant execute on function public.escalate_hr_approvals(), public.attendance_alerts_run() to service_role;

-- patients are not employees: keep them out of the staff self-service functions
revoke execute on function public.patient_id_from_path(text) from public, anon;
grant execute on function public.patient_id_from_path(text) to authenticated;
