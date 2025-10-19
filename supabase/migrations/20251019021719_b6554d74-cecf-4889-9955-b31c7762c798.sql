-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily attendance reset at 4 PM UTC (midnight Malaysia time)
SELECT cron.schedule(
  'daily-attendance-reset',
  '0 16 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://zrxwrdkodjlnkupfqwfa.supabase.co/functions/v1/daily-attendance-reset',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyeHdyZGtvZGpsbmt1cGZxd2ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MzQ2MjUsImV4cCI6MjA3NjAxMDYyNX0.mSByudOwp0JoWnQRFcqNzaJdFe34gL5Iwn0U8McBXUI"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);