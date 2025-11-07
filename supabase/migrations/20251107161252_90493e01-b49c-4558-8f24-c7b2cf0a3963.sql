-- Ensure extension for gen_random_uuid (safety)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Index for user_roles.user_id
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- RPC: users with aggregated roles (fixed type)
CREATE OR REPLACE FUNCTION public.get_users_with_roles()
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  created_at timestamptz,
  roles user_role[]
) AS $$
  SELECT p.id,
         p.nome,
         p.email,
         p.created_at,
         COALESCE(array_agg(DISTINCT ur.role) FILTER (WHERE ur.role IS NOT NULL), ARRAY[]::user_role[]) AS roles
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  GROUP BY p.id, p.nome, p.email, p.created_at
  ORDER BY p.created_at DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_users_with_roles() TO authenticated;