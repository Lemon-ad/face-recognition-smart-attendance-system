-- Step 1: Create role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

-- Step 2: Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Step 3: Migrate existing role data from users table to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT auth_uuid, role::text::app_role
FROM public.users
WHERE auth_uuid IS NOT NULL;

-- Step 4: Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Step 5: Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies for users table
-- Allow unauthenticated login lookups by username
CREATE POLICY "Allow username lookup for login"
ON public.users
FOR SELECT
TO anon
USING (true);

-- Admins can see all users
CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Members can view their own profile
CREATE POLICY "Members can view own profile"
ON public.users
FOR SELECT
TO authenticated
USING (auth_uuid = auth.uid());

-- Admins can update all users
CREATE POLICY "Admins can update all users"
ON public.users
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Members can update their own profile
CREATE POLICY "Members can update own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (auth_uuid = auth.uid());

-- Only admins can insert users
CREATE POLICY "Admins can insert users"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete users
CREATE POLICY "Admins can delete users"
ON public.users
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Step 7: Create RLS policies for attendance table
-- Admins can see all attendance records
CREATE POLICY "Admins can view all attendance"
ON public.attendance
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Members can view their own attendance
CREATE POLICY "Members can view own attendance"
ON public.attendance
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can manage all attendance
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

-- Step 8: Create RLS policies for department table
-- All authenticated users can view departments
CREATE POLICY "Authenticated users can view departments"
ON public.department
FOR SELECT
TO authenticated
USING (true);

-- Only admins can manage departments
CREATE POLICY "Admins can insert departments"
ON public.department
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update departments"
ON public.department
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete departments"
ON public.department
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Step 9: Create RLS policies for group table
-- All authenticated users can view groups
CREATE POLICY "Authenticated users can view groups"
ON public.group
FOR SELECT
TO authenticated
USING (true);

-- Only admins can manage groups
CREATE POLICY "Admins can insert groups"
ON public.group
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update groups"
ON public.group
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete groups"
ON public.group
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Step 10: Create RLS policies for user_roles table
-- Admins can view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Only admins can manage roles
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));