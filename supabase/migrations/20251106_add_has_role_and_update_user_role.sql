CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Verifica se usuário possui determinada role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.user_role)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
  );
$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.user_role) TO authenticated;

-- Atualiza a role de um usuário (apenas admins)
CREATE OR REPLACE FUNCTION public.update_user_role(_user_id uuid, _role public.user_role)
RETURNS void AS $
DECLARE
  row_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Permission denied: only admins can update roles';
  END IF;

  UPDATE public.user_roles
  SET role = _role
  WHERE user_id = _user_id;
  
  GET DIAGNOSTICS row_count = ROW_COUNT;
  
  IF row_count = 0 THEN
    RAISE EXCEPTION 'User role not found for user_id: %', _user_id;
  END IF;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.update_user_role(uuid, public.user_role) TO authenticated;
