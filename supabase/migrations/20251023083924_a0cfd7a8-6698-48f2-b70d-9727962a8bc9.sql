-- Fix RLS policies for attendance table to work with user_id mapping
-- First, drop the existing policies
DROP POLICY IF EXISTS "Admins can view all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Members can view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can update attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can delete attendance" ON public.attendance;

-- Create corrected policies that map auth.uid() to users.auth_uuid to users.user_id
CREATE POLICY "Admins can view all attendance"
ON public.attendance
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Members can view own attendance"
ON public.attendance
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT user_id FROM public.users WHERE auth_uuid = auth.uid()
  )
);

CREATE POLICY "Service role can insert attendance"
ON public.attendance
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update attendance"
ON public.attendance
FOR UPDATE
TO service_role
USING (true);

CREATE POLICY "Admins can insert attendance"
ON public.attendance
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update attendance"
ON public.attendance
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete attendance"
ON public.attendance
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));