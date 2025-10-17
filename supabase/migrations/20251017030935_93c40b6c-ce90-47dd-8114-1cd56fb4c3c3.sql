-- Create attendance_history table to store archived attendance records
CREATE TABLE IF NOT EXISTS public.attendance_history (
  history_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_id UUID NOT NULL,
  user_id UUID NOT NULL,
  check_in_time TIMESTAMP WITHOUT TIME ZONE,
  check_out_time TIMESTAMP WITHOUT TIME ZONE,
  status attendance_status_enum NOT NULL,
  location VARCHAR,
  attendance_date DATE NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE,
  updated_at TIMESTAMP WITHOUT TIME ZONE,
  archived_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create index on attendance_date for faster queries
CREATE INDEX IF NOT EXISTS idx_attendance_history_date ON public.attendance_history(attendance_date);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_attendance_history_user_id ON public.attendance_history(user_id);

-- Enable RLS on attendance_history
ALTER TABLE public.attendance_history ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read attendance history
CREATE POLICY "Users can view attendance history"
ON public.attendance_history
FOR SELECT
USING (true);

-- Update the cron job schedule for archive-attendance (3:59 PM UTC)
SELECT cron.schedule(
  'archive-attendance-daily',
  '59 15 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://zrxwrdkodjlnkupfqwfa.supabase.co/functions/v1/archive-attendance',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyeHdyZGtvZGpsbmt1cGZxd2ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MzQ2MjUsImV4cCI6MjA3NjAxMDYyNX0.mSByudOwp0JoWnQRFcqNzaJdFe34gL5Iwn0U8McBXUI"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Update the cron job schedule for daily-attendance-reset (4:00 PM UTC = 12:00 AM Malaysia)
SELECT cron.schedule(
  'daily-attendance-reset',
  '0 16 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://zrxwrdkodjlnkupfqwfa.supabase.co/functions/v1/daily-attendance-reset',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyeHdyZGtvZGpsbmt1cGZxd2ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MzQ2MjUsImV4cCI6MjA3NjAxMDYyNX0.mSByudOwp0JoWnQRFcqNzaJdFe34gL5Iwn0U8McBXUI"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);