-- Enable RLS on attendance_history table
ALTER TABLE public.attendance_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for attendance_history table
-- Admins can see all attendance history
CREATE POLICY "Admins can view all attendance history"
ON public.attendance_history
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Members can view their own attendance history
CREATE POLICY "Members can view own attendance history"
ON public.attendance_history
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Only admins can manage attendance history
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