-- Remove the policy that allows members to update their own profile
DROP POLICY IF EXISTS "Members can update own profile" ON public.users;

-- The remaining policies ensure:
-- 1. Members can only VIEW their own profile (SELECT policy exists)
-- 2. Admins can add, delete, and update all profiles (INSERT/UPDATE/DELETE policies exist)