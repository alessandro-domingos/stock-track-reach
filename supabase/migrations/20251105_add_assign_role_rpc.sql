-- Creates RPCs to assign and update a user's role as SECURITY DEFINER.
-- The functions check that the caller is an admin (in public.user_roles) before performing changes.

CREATE OR REPLACE FUNCTION public.assign_role_to_user(_user_id uuid, _role public.user_role)
RETURNS void AS $$
BEGIN
  -- Only allow callers who already have the admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Permission denied: only admins can assign roles';
  END IF;

  INSERT INTO public.user_roles (id, user_id, role, created_at)
  VALUES (gen_random_uuid(), _user_id, _role, NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_user_role(_user_id uuid, _role public.user_role)
RETURNS void AS $$
BEGIN
  -- Only allow callers who already have the admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Permission denied: only admins can update roles';
  END IF;

  UPDATE public.user_roles SET role = _role WHERE user_id = _user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated users. The functions themselves validate admin role.
GRANT EXECUTE ON FUNCTION public.assign_role_to_user(uuid, public.user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_role(uuid, public.user_role) TO authenticated;