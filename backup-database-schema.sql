-- ============================================
-- BACKUP DO SCHEMA DO BANCO DE DADOS
-- Data de criação: 2025-11-09
-- Sistema: Gestão de Estoque e Liberações
-- ============================================

-- ============================================
-- 1. CRIAÇÃO DOS TIPOS ENUM
-- ============================================

CREATE TYPE public.user_role AS ENUM (
  'logistica',
  'comercial',
  'cliente',
  'armazem',
  'admin'
);

CREATE TYPE public.status_liberacao AS ENUM (
  'pendente',
  'parcial',
  'concluido'
);

CREATE TYPE public.status_carregamento AS ENUM (
  'aguardando',
  'liberado',
  'carregando',
  'carregado',
  'nf_entregue'
);

CREATE TYPE public.tipo_foto AS ENUM (
  'chegada',
  'durante',
  'carregado',
  'saida'
);

-- ============================================
-- 2. CRIAÇÃO DAS TABELAS
-- ============================================

-- Tabela: profiles
CREATE TABLE public.profiles (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Tabela: user_roles
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (user_id, role)
);

-- Tabela: role_permissions
CREATE TABLE public.role_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role public.user_role NOT NULL,
  resource text NOT NULL,
  can_create boolean DEFAULT false,
  can_read boolean DEFAULT false,
  can_update boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Tabela: produtos
CREATE TABLE public.produtos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  unidade text DEFAULT 't'::text,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Tabela: armazens
CREATE TABLE public.armazens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cidade text NOT NULL,
  estado text NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Tabela: estoque
CREATE TABLE public.estoque (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  armazem_id uuid NOT NULL REFERENCES public.armazens(id) ON DELETE CASCADE,
  quantidade numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id),
  PRIMARY KEY (id),
  UNIQUE (produto_id, armazem_id)
);

-- Tabela: liberacoes
CREATE TABLE public.liberacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  armazem_id uuid NOT NULL REFERENCES public.armazens(id) ON DELETE RESTRICT,
  cliente_nome text NOT NULL,
  pedido_interno text NOT NULL,
  quantidade_liberada numeric NOT NULL,
  quantidade_retirada numeric NOT NULL DEFAULT 0,
  status public.status_liberacao DEFAULT 'pendente'::status_liberacao,
  data_liberacao date DEFAULT CURRENT_DATE,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Tabela: agendamentos
CREATE TABLE public.agendamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  liberacao_id uuid NOT NULL REFERENCES public.liberacoes(id) ON DELETE CASCADE,
  data_retirada date NOT NULL,
  horario time without time zone NOT NULL,
  quantidade numeric NOT NULL,
  motorista_nome text NOT NULL,
  motorista_documento text NOT NULL,
  placa_caminhao text NOT NULL,
  tipo_caminhao text,
  status text DEFAULT 'confirmado'::text,
  observacoes text,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Tabela: carregamentos
CREATE TABLE public.carregamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  status public.status_carregamento DEFAULT 'aguardando'::status_carregamento,
  numero_nf text,
  observacoes text,
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Tabela: fotos_carregamento
CREATE TABLE public.fotos_carregamento (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  carregamento_id uuid NOT NULL REFERENCES public.carregamentos(id) ON DELETE CASCADE,
  tipo public.tipo_foto NOT NULL,
  url text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- ============================================
-- 3. CRIAÇÃO DAS FUNÇÕES
-- ============================================

-- Função: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Função: handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Função: assign_default_role
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'cliente'::user_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Função: update_user_role
CREATE OR REPLACE FUNCTION public.update_user_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- Função: get_users_with_roles
CREATE OR REPLACE FUNCTION public.get_users_with_roles()
RETURNS TABLE(
  id uuid,
  nome text,
  email text,
  created_at timestamp with time zone,
  roles user_role[]
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT 
    p.id,
    p.nome,
    p.email,
    p.created_at,
    COALESCE(array_agg(DISTINCT ur.role) FILTER (WHERE ur.role IS NOT NULL), ARRAY[]::user_role[]) AS roles
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  GROUP BY p.id, p.nome, p.email, p.created_at
  ORDER BY p.created_at DESC;
$$;

-- ============================================
-- 4. CRIAÇÃO DOS TRIGGERS
-- ============================================

-- Trigger: on_auth_user_created (handle_new_user)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger: on_user_created_assign_role (assign_default_role)
CREATE TRIGGER on_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_role();

-- ============================================
-- 5. HABILITAÇÃO DO ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.armazens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liberacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carregamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fotos_carregamento ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. CRIAÇÃO DAS POLÍTICAS RLS
-- ============================================

-- Políticas: profiles
CREATE POLICY "Usuários podem ver próprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar próprio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admin can view all profiles"
  ON public.profiles FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admin can update all profiles"
  ON public.profiles FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Políticas: user_roles
CREATE POLICY "Usuários podem ver próprias roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Only admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admin can manage all roles"
  ON public.user_roles FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Políticas: role_permissions
CREATE POLICY "Admins can manage permissions"
  ON public.role_permissions FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Políticas: produtos
CREATE POLICY "Todos podem ver produtos"
  ON public.produtos FOR SELECT
  USING (true);

CREATE POLICY "Logística pode gerenciar produtos"
  ON public.produtos FOR ALL
  USING (has_role(auth.uid(), 'logistica'::user_role));

-- Políticas: armazens
CREATE POLICY "Todos podem ver armazéns"
  ON public.armazens FOR SELECT
  USING (true);

CREATE POLICY "Logística pode gerenciar armazéns"
  ON public.armazens FOR ALL
  USING (has_role(auth.uid(), 'logistica'::user_role));

-- Políticas: estoque
CREATE POLICY "Todos podem ver estoque"
  ON public.estoque FOR SELECT
  USING (true);

CREATE POLICY "Logística pode gerenciar estoque"
  ON public.estoque FOR ALL
  USING (has_role(auth.uid(), 'logistica'::user_role));

-- Políticas: liberacoes
CREATE POLICY "Role-based access to releases"
  ON public.liberacoes FOR SELECT
  USING (
    has_role(auth.uid(), 'logistica'::user_role) OR 
    has_role(auth.uid(), 'armazem'::user_role)
  );

CREATE POLICY "Logística pode criar liberações"
  ON public.liberacoes FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'logistica'::user_role));

CREATE POLICY "Logística pode atualizar liberações"
  ON public.liberacoes FOR UPDATE
  USING (has_role(auth.uid(), 'logistica'::user_role));

-- Políticas: agendamentos
CREATE POLICY "Users can view relevant appointments"
  ON public.agendamentos FOR SELECT
  USING (
    created_by = auth.uid() OR 
    has_role(auth.uid(), 'logistica'::user_role) OR 
    has_role(auth.uid(), 'armazem'::user_role)
  );

CREATE POLICY "Clientes podem criar agendamentos"
  ON public.agendamentos FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'cliente'::user_role) OR 
    has_role(auth.uid(), 'logistica'::user_role)
  );

CREATE POLICY "Clientes podem atualizar próprios agendamentos"
  ON public.agendamentos FOR UPDATE
  USING (created_by = auth.uid());

-- Políticas: carregamentos
CREATE POLICY "Todos podem ver carregamentos"
  ON public.carregamentos FOR SELECT
  USING (true);

CREATE POLICY "Armazém pode gerenciar carregamentos"
  ON public.carregamentos FOR ALL
  USING (
    has_role(auth.uid(), 'armazem'::user_role) OR 
    has_role(auth.uid(), 'logistica'::user_role)
  );

-- Políticas: fotos_carregamento
CREATE POLICY "Todos podem ver fotos"
  ON public.fotos_carregamento FOR SELECT
  USING (true);

CREATE POLICY "Armazém pode adicionar fotos"
  ON public.fotos_carregamento FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'armazem'::user_role) OR 
    has_role(auth.uid(), 'logistica'::user_role)
  );

-- ============================================
-- 7. CRIAÇÃO DO BUCKET DE STORAGE
-- ============================================

-- Criar bucket para fotos de carregamento
INSERT INTO storage.buckets (id, name, public)
VALUES ('carregamento-fotos', 'carregamento-fotos', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
CREATE POLICY "Authenticated users can upload photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'carregamento-fotos' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can view photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'carregamento-fotos' AND
    auth.role() = 'authenticated'
  );

-- ============================================
-- FIM DO BACKUP
-- ============================================
