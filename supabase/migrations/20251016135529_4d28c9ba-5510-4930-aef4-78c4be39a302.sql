-- Create attendance_history table to store archived attendance records
CREATE TABLE IF NOT EXISTS public.attendance_history (
  history_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_id UUID NOT NULL,
  user_id UUID NOT NULL,
  check_in_time TIMESTAMP WITHOUT TIME ZONE,
  check_out_time TIMESTAMP WITHOUT TIME ZONE,
  status attendance_status_enum NOT NULL,
  location CHARACTER VARYING,
  attendance_date DATE NOT NULL,
  archived_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITHOUT TIME ZONE,
  updated_at TIMESTAMP WITHOUT TIME ZONE
);

-- Create index for faster queries by user_id and date
CREATE INDEX idx_attendance_history_user_date ON public.attendance_history(user_id, attendance_date);
CREATE INDEX idx_attendance_history_date ON public.attendance_history(attendance_date);

-- Enable RLS on attendance_history
ALTER TABLE public.attendance_history ENABLE ROW LEVEL SECURITY;

-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the archive function to run daily at 4am Malaysia time (UTC+8, so 20:00 UTC previous day)
-- Note: pg_cron uses UTC time, so 4am MYT = 8pm UTC previous day
SELECT cron.schedule(
  'archive-daily-attendance',
  '0 20 * * *', -- 8pm UTC = 4am MYT next day
  $$
  SELECT
    net.http_post(
        url:='https://zrxwrdkodjlnkupfqwfa.supabase.co/functions/v1/archive-attendance',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyeHdyZGtvZGpsbmt1cGZxd2ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MzQ2MjUsImV4cCI6MjA3NjAxMDYyNX0.mSByudOwp0JoWnQRFcqNzaJdFe34gL5Iwn0U8McBXUI"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);