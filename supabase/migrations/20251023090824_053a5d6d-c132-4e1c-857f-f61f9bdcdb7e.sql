-- Drop all policies on attendance_history table
DROP POLICY IF EXISTS "Admins can view all attendance history" ON public.attendance_history;
DROP POLICY IF EXISTS "Members can view own attendance history" ON public.attendance_history;
DROP POLICY IF EXISTS "Admins can insert attendance history" ON public.attendance_history;
DROP POLICY IF EXISTS "Admins can update attendance history" ON public.attendance_history;
DROP POLICY IF EXISTS "Admins can delete attendance history" ON public.attendance_history;

-- Drop the attendance_history table completely
-- All attendance records should be stored in the attendance table only
DROP TABLE IF EXISTS public.attendance_history CASCADE;

-- Remove any indexes related to attendance_history
DROP INDEX IF EXISTS public.idx_attendance_history_user_date;
DROP INDEX IF EXISTS public.idx_attendance_history_date;