-- Criar tabela de permissões de acesso por role
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL,
  resource text NOT NULL,
  can_create boolean DEFAULT false,
  can_read boolean DEFAULT false,
  can_update boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(role, resource)
);

-- Habilitar RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Policy para admins gerenciarem permissões
CREATE POLICY "Admins can manage permissions" ON public.role_permissions
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Inserir permissões padrão para cada role (será feito via insert tool)

-- Atualizar políticas para permitir admin gerenciar user_roles
DROP POLICY IF EXISTS "Prevent non-admin role insertion" ON public.user_roles;

CREATE POLICY "Admin can manage all roles" ON public.user_roles
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Prevent non-admin role insertion" ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Adicionar policy para admin visualizar todos os perfis
CREATE POLICY "Admin can view all profiles" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update all profiles" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));