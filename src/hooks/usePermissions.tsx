import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type UserRole = Database['public']['Enums']['user_role'];

export type Resource = 
  | 'users' 
  | 'roles' 
  | 'estoque' 
  | 'produtos' 
  | 'armazens' 
  | 'liberacoes' 
  | 'agendamentos' 
  | 'carregamentos';

export interface Permission {
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export const usePermissions = () => {
  const { userRoles } = useAuth();
  const [permissions, setPermissions] = useState<Record<Resource, Permission>>({} as Record<Resource, Permission>);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (userRoles.length === 0) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .in('role', userRoles as UserRole[]);

      if (!error && data) {
        const permsMap: Record<string, Permission> = {};
        
        data.forEach(perm => {
          if (!permsMap[perm.resource]) {
            permsMap[perm.resource] = {
              can_create: false,
              can_read: false,
              can_update: false,
              can_delete: false
            };
          }
          
          // Combinar permissões (se usuário tem múltiplas roles, usar a mais permissiva)
          permsMap[perm.resource].can_create = permsMap[perm.resource].can_create || perm.can_create;
          permsMap[perm.resource].can_read = permsMap[perm.resource].can_read || perm.can_read;
          permsMap[perm.resource].can_update = permsMap[perm.resource].can_update || perm.can_update;
          permsMap[perm.resource].can_delete = permsMap[perm.resource].can_delete || perm.can_delete;
        });

        setPermissions(permsMap as Record<Resource, Permission>);
      }
      
      setLoading(false);
    };

    fetchPermissions();
  }, [userRoles]);

  const canAccess = (resource: Resource, action: 'create' | 'read' | 'update' | 'delete' = 'read'): boolean => {
    const perm = permissions[resource];
    if (!perm) return false;

    switch (action) {
      case 'create':
        return perm.can_create;
      case 'read':
        return perm.can_read;
      case 'update':
        return perm.can_update;
      case 'delete':
        return perm.can_delete;
      default:
        return false;
    }
  };

  return { permissions, canAccess, loading };
};
