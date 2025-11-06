-- Remove políticas conflitantes que bloqueiam todas as inserções
DROP POLICY IF EXISTS "Prevent manual role insertion" ON public.user_roles;
DROP POLICY IF EXISTS "Prevent non-admin role insertion" ON public.user_roles;

-- Criar política correta: apenas admins podem inserir roles
CREATE POLICY "Only admins can insert roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));