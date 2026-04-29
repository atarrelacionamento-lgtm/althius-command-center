import { useAuthContext } from '@/contexts/AuthContext';
import { isAdmin, hasPermission } from '@/lib/roles';
import type { Role } from '@/types';

export function useAuth() {
  const { session, profile, role, loading } = useAuthContext();

  return {
    session,
    profile,
    role,
    loading,
    isAuthenticated: !!session,
    isAdmin: isAdmin(role),
    hasPermission: (required: Role) => hasPermission(role, required),
  };
}
