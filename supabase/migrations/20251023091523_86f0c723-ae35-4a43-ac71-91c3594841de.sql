-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the daily attendance reset to run at 4pm UTC (midnight Malaysia time)
-- This creates attendance records for members only with status 'absent' by default
SELECT cron.schedule(
  'daily-attendance-reset-4pm-utc',
  '0 16 * * *', -- Run at 16:00 (4pm) UTC every day
  $$
  SELECT
    net.http_post(
        url:='https://zrxwrdkodjlnkupfqwfa.supabase.co/functions/v1/daily-attendance-reset',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyeHdyZGtvZGpsbmt1cGZxd2ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MzQ2MjUsImV4cCI6MjA3NjAxMDYyNX0.mSByudOwp0JoWnQRFcqNzaJdFe34gL5Iwn0U8McBXUI"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);