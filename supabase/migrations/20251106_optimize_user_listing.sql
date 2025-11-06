CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

CREATE OR REPLACE FUNCTION public.get_users_with_roles()
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  created_at timestamptz,
  roles text[]
) AS $$
  -- Verificar se o usuário atual é admin
  SELECT p.id,
         p.nome,
         p.email,
         p.created_at,
         COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), ARRAY[]::text[]) AS roles
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE EXISTS (
    SELECT 1 FROM public.user_roles admin_check
    WHERE admin_check.user_id = auth.uid() AND admin_check.role = 'admin'
  )
  GROUP BY p.id, p.nome, p.email, p.created_at
  ORDER BY p.created_at DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_users_with_roles() TO authenticated;
