import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { Role } from '@/types';

interface CanProps {
  /** Renderiza filhos apenas para admin */
  admin?: boolean;
  /** Renderiza filhos para quem tem ao menos esse role */
  role?: Role;
  children: ReactNode;
}

/**
 * Componente de guarda de UI baseado em role.
 *
 * Uso:
 *   <Can admin><Button>Criar</Button></Can>
 *   <Can role="admin"><Button>Editar</Button></Can>
 *   <Can role="user"><Button>Importar</Button></Can>  ← user e admin veem
 */
export function Can({ admin, role, children }: CanProps) {
  const { isAdmin: userIsAdmin, hasPermission } = useAuth();

  if (admin && !userIsAdmin) return null;
  if (role && !hasPermission(role)) return null;

  return <>{children}</>;
}
