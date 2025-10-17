-- Drop the existing trigger on attendance table
DROP TRIGGER IF EXISTS update_attendance_updated_at ON attendance;

-- Create a new function specifically for attendance that stores updated_at as UTC+8
CREATE OR REPLACE FUNCTION public.update_attendance_updated_at_utc8()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW() + INTERVAL '8 hours';
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for attendance table to use UTC+8
CREATE TRIGGER update_attendance_updated_at
BEFORE UPDATE ON attendance
FOR EACH ROW
EXECUTE FUNCTION public.update_attendance_updated_at_utc8();

-- Also update created_at to use UTC+8 by default for new attendance records
ALTER TABLE attendance 
ALTER COLUMN created_at SET DEFAULT (NOW() + INTERVAL '8 hours');

-- Update the daily_attendance_reset function to not add 8 hours since created_at will already be UTC+8
CREATE OR REPLACE FUNCTION public.daily_attendance_reset()
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Insert new absent rows for users without attendance today
  INSERT INTO attendance (user_id, status, check_in_time, check_out_time, created_at)
  SELECT u.user_id, 'absent', NULL, NULL, NOW() + INTERVAL '8 hours'
  FROM users u
  WHERE u.role = 'member'
    AND NOT EXISTS (
      SELECT 1
      FROM attendance a
      WHERE a.user_id = u.user_id
        AND a.status = 'absent'
        AND a.created_at::date = (NOW() + INTERVAL '8 hours')::date
    );
END;
$function$;