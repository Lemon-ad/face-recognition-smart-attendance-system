-- Create a secure function to get email for login purposes
-- This is safe because:
-- 1. It only returns email (which is needed for Supabase auth)
-- 2. Password is still required for actual authentication
-- 3. Uses SECURITY DEFINER to bypass RLS for this specific use case
CREATE OR REPLACE FUNCTION public.get_email_for_login(username_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Fetch email for the given username
  SELECT email INTO user_email
  FROM public.users
  WHERE username = username_input
  LIMIT 1;
  
  -- Return the email (or NULL if username doesn't exist)
  RETURN user_email;
END;
$$;