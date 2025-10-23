-- Fix RLS policies for attendance_history table
DROP POLICY IF EXISTS "Admins can view all attendance history" ON public.attendance_history;
DROP POLICY IF EXISTS "Members can view own attendance history" ON public.attendance_history;
DROP POLICY IF EXISTS "Admins can insert attendance history" ON public.attendance_history;
DROP POLICY IF EXISTS "Admins can update attendance history" ON public.attendance_history;
DROP POLICY IF EXISTS "Admins can delete attendance history" ON public.attendance_history;

-- Create corrected policies
CREATE POLICY "Admins can view all attendance history"
ON public.attendance_history
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can view own attendance history"
ON public.attendance_history
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT user_id FROM public.users WHERE auth_uuid = auth.uid()
  )
);

CREATE POLICY "Admins can insert attendance history"
ON public.attendance_history
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update attendance history"
ON public.attendance_history
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete attendance history"
ON public.attendance_history
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));