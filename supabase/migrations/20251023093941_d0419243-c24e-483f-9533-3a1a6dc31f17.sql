-- Fix 1: Create secure username lookup function
CREATE OR REPLACE FUNCTION public.username_exists(username_input text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM users WHERE username = username_input
  );
$$;

-- Fix 2: Drop the overly permissive login policy
DROP POLICY IF EXISTS "Allow username lookup for login" ON public.users;

-- Fix 3: Add secure search_path to database functions
CREATE OR REPLACE FUNCTION public.update_attendance_updated_at_utc8()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
   NEW.updated_at = NOW() + INTERVAL '8 hours';
   RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_daily_absent()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  INSERT INTO attendance (user_id, status, check_in_time, check_out_time, created_at)
  SELECT u.auth_id, 'absent', NULL, NULL, NOW()
  FROM users u
  WHERE u.role = 'member'
  AND NOT EXISTS (
    SELECT 1 FROM attendance
    WHERE user_id = u.auth_id
    AND created_at::date = NOW()::date
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.daily_attendance_reset()
RETURNS TABLE(created integer, run_date date)
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  kl_today date := (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date;
BEGIN
  WITH ins AS (
    INSERT INTO public.attendance (user_id, status, check_in_time, check_out_time, location)
    SELECT u.user_id, 'absent', NULL, NULL, NULL
    FROM public.users u
    WHERE u.role IS DISTINCT FROM 'admin'::user_role_enum
    ON CONFLICT (user_id, (created_at::date)) DO NOTHING
    RETURNING user_id
  )
  SELECT (SELECT count(*) FROM ins) AS created,
         kl_today                  AS run_date
  INTO created, run_date;

  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at_myt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at := (now() AT TIME ZONE 'Asia/Kuala_Lumpur');
  RETURN NEW;
END;
$function$;