-- Tipos de perfil de usuário
CREATE TYPE user_role AS ENUM ('logistica', 'comercial', 'cliente', 'armazem');

-- Tipos de status
CREATE TYPE status_carregamento AS ENUM ('aguardando', 'liberado', 'carregando', 'carregado', 'nf_entregue');
CREATE TYPE status_liberacao AS ENUM ('pendente', 'parcial', 'concluido');
CREATE TYPE tipo_foto AS ENUM ('chegada', 'durante', 'carregado', 'saida');

-- Tabela de perfis de usuário
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de roles (separada por segurança)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Tabela de armazéns
CREATE TABLE public.armazens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de produtos
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  unidade TEXT DEFAULT 't',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de estoque
CREATE TABLE public.estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE NOT NULL,
  armazem_id UUID REFERENCES public.armazens(id) ON DELETE CASCADE NOT NULL,
  quantidade DECIMAL(10, 2) DEFAULT 0 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id),
  UNIQUE(produto_id, armazem_id)
);

-- Tabela de liberações
CREATE TABLE public.liberacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES public.produtos(id) NOT NULL,
  armazem_id UUID REFERENCES public.armazens(id) NOT NULL,
  cliente_nome TEXT NOT NULL,
  pedido_interno TEXT NOT NULL,
  quantidade_liberada DECIMAL(10, 2) NOT NULL,
  quantidade_retirada DECIMAL(10, 2) DEFAULT 0 NOT NULL,
  status status_liberacao DEFAULT 'pendente',
  data_liberacao DATE DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de agendamentos
CREATE TABLE public.agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liberacao_id UUID REFERENCES public.liberacoes(id) ON DELETE CASCADE NOT NULL,
  data_retirada DATE NOT NULL,
  horario TIME NOT NULL,
  quantidade DECIMAL(10, 2) NOT NULL,
  placa_caminhao TEXT NOT NULL,
  tipo_caminhao TEXT,
  motorista_nome TEXT NOT NULL,
  motorista_documento TEXT NOT NULL,
  observacoes TEXT,
  status TEXT DEFAULT 'confirmado',
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de carregamentos
CREATE TABLE public.carregamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE CASCADE NOT NULL,
  status status_carregamento DEFAULT 'aguardando',
  numero_nf TEXT,
  observacoes TEXT,
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de fotos de carregamento
CREATE TABLE public.fotos_carregamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carregamento_id UUID REFERENCES public.carregamentos(id) ON DELETE CASCADE NOT NULL,
  tipo tipo_foto NOT NULL,
  url TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Função para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Trigger para criar perfil automaticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função de segurança para verificar role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies

-- Profiles: todos podem ver seus próprios perfis
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver próprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar próprio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- User Roles: apenas admins podem gerenciar
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver próprias roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Armazéns: todos autenticados podem visualizar
ALTER TABLE public.armazens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver armazéns"
  ON public.armazens FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Logística pode gerenciar armazéns"
  ON public.armazens FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'logistica'));

-- Produtos: todos autenticados podem visualizar
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver produtos"
  ON public.produtos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Logística pode gerenciar produtos"
  ON public.produtos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'logistica'));

-- Estoque: todos podem visualizar, logística pode atualizar
ALTER TABLE public.estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver estoque"
  ON public.estoque FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Logística pode gerenciar estoque"
  ON public.estoque FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'logistica'));

-- Liberações: todos podem visualizar, logística pode criar/editar
ALTER TABLE public.liberacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver liberações"
  ON public.liberacoes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Logística pode criar liberações"
  ON public.liberacoes FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'logistica'));

CREATE POLICY "Logística pode atualizar liberações"
  ON public.liberacoes FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'logistica'));

-- Agendamentos: clientes podem criar, todos podem visualizar
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver agendamentos"
  ON public.agendamentos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Clientes podem criar agendamentos"
  ON public.agendamentos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'cliente') OR 
    public.has_role(auth.uid(), 'logistica')
  );

CREATE POLICY "Clientes podem atualizar próprios agendamentos"
  ON public.agendamentos FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

-- Carregamentos: armazém pode gerenciar
ALTER TABLE public.carregamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver carregamentos"
  ON public.carregamentos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Armazém pode gerenciar carregamentos"
  ON public.carregamentos FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'armazem') OR 
    public.has_role(auth.uid(), 'logistica')
  );

-- Fotos: armazém pode adicionar
ALTER TABLE public.fotos_carregamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver fotos"
  ON public.fotos_carregamento FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Armazém pode adicionar fotos"
  ON public.fotos_carregamento FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'armazem') OR 
    public.has_role(auth.uid(), 'logistica')
  );

-- Criar bucket de storage para fotos
INSERT INTO storage.buckets (id, name, public)
VALUES ('carregamento-fotos', 'carregamento-fotos', true);

-- RLS para storage
CREATE POLICY "Todos podem ver fotos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'carregamento-fotos');

CREATE POLICY "Armazém pode fazer upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'carregamento-fotos' AND
    auth.role() = 'authenticated'
  );

-- Inserir dados de exemplo
INSERT INTO public.armazens (nome, cidade, estado) VALUES
  ('Armazém São Paulo', 'São Paulo', 'SP'),
  ('Armazém Rio de Janeiro', 'Rio de Janeiro', 'RJ'),
  ('Armazém Belo Horizonte', 'Belo Horizonte', 'MG'),
  ('Armazém Curitiba', 'Curitiba', 'PR');

INSERT INTO public.produtos (nome, unidade) VALUES
  ('Ureia', 't'),
  ('NPK 20-05-20', 't'),
  ('Super Simples', 't'),
  ('MAP', 't');

-- Inserir estoque inicial
INSERT INTO public.estoque (produto_id, armazem_id, quantidade)
SELECT p.id, a.id, (random() * 50 + 10)::DECIMAL(10,2)
FROM public.produtos p
CROSS JOIN public.armazens a;