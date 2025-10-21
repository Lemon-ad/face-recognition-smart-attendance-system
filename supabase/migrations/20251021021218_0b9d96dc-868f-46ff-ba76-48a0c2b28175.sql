-- Create trigger to automatically remove users from groups when removed from department
CREATE OR REPLACE FUNCTION public.auto_remove_group_on_dept_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When department_id is set to NULL, also set group_id to NULL
  IF NEW.department_id IS NULL AND OLD.department_id IS NOT NULL THEN
    NEW.group_id := NULL;
  END IF;
  
  -- When department_id changes, check if the group belongs to the new department
  -- If not, remove the user from the group
  IF NEW.department_id IS DISTINCT FROM OLD.department_id AND NEW.group_id IS NOT NULL THEN
    -- Check if the current group belongs to the new department
    IF NOT EXISTS (
      SELECT 1 FROM public.group 
      WHERE group_id = NEW.group_id 
      AND department_id = NEW.department_id
    ) THEN
      NEW.group_id := NULL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on users table
DROP TRIGGER IF EXISTS trigger_auto_remove_group ON public.users;
CREATE TRIGGER trigger_auto_remove_group
  BEFORE UPDATE OF department_id ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_remove_group_on_dept_removal();