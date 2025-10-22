-- Fix 1: Restrict agendamentos access to only relevant users
DROP POLICY IF EXISTS "Todos podem ver agendamentos" ON public.agendamentos;

CREATE POLICY "Users can view relevant appointments"
  ON public.agendamentos FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    public.has_role(auth.uid(), 'logistica'::user_role) OR
    public.has_role(auth.uid(), 'armazem'::user_role)
  );

-- Fix 2: Restrict liberacoes access to only authorized roles
DROP POLICY IF EXISTS "Todos podem ver liberações" ON public.liberacoes;

CREATE POLICY "Role-based access to releases"
  ON public.liberacoes FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'logistica'::user_role) OR
    public.has_role(auth.uid(), 'armazem'::user_role)
  );

-- Fix 3: Auto-assign default role on signup via trigger
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'cliente'::user_role);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS assign_role_on_signup ON auth.users;
CREATE TRIGGER assign_role_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_role();

-- Fix 4: Prevent users from self-assigning roles (only allow default via trigger)
CREATE POLICY "Prevent manual role insertion"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Fix 5: Make storage bucket private and restrict access
UPDATE storage.buckets 
SET public = false 
WHERE id = 'carregamento-fotos';

DROP POLICY IF EXISTS "Todos podem ver fotos" ON storage.objects;

CREATE POLICY "Authenticated users with proper role can view photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'carregamento-fotos' AND (
      public.has_role(auth.uid(), 'logistica'::user_role) OR
      public.has_role(auth.uid(), 'armazem'::user_role)
    )
  );