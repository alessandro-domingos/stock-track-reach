-- Adicionar role de admin ao enum existente
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';