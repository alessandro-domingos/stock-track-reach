-- Função para atualizar role de usuário (somente admins)
CREATE OR REPLACE FUNCTION public.update_user_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifica se o usuário que está chamando é admin
  IF NOT public.has_role(auth.uid(), 'admin'::user_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem atualizar roles';
  END IF;

  -- Atualiza a role do usuário
  UPDATE public.user_roles
  SET role = _role
  WHERE user_id = _user_id;

  -- Se não encontrou o usuário, retorna false
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- Grant para authenticated
GRANT EXECUTE ON FUNCTION public.update_user_role(uuid, user_role) TO authenticated;