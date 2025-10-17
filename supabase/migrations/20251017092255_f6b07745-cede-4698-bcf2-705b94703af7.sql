-- Add updated_at column to attendance table
ALTER TABLE public.attendance 
ADD COLUMN updated_at timestamp without time zone DEFAULT now();

-- Create trigger to automatically update updated_at on row updates
CREATE TRIGGER update_attendance_updated_at
BEFORE UPDATE ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();