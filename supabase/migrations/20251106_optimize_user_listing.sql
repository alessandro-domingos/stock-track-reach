-- Índice para acelerar buscas por user_id em user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- RPC para retornar usuários com suas roles agregadas
CREATE OR REPLACE FUNCTION public.get_users_with_roles()
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  created_at timestamptz,
  roles text[]
) AS $$
  SELECT p.id,
         p.nome,
         p.email,
         p.created_at,
         COALESCE(array_agg(DISTINCT ur.role) FILTER (WHERE ur.role IS NOT NULL), ARRAY[]::text[]) AS roles
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  GROUP BY p.id, p.nome, p.email, p.created_at
  ORDER BY p.created_at DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_users_with_roles() TO authenticated;
