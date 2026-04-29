import type { Role } from '@/types';

export function isAdmin(role: Role | null | undefined): boolean {
  return role === 'admin';
}

export function hasPermission(role: Role | null | undefined, required: Role): boolean {
  if (required === 'user') return role === 'user' || role === 'admin';
  if (required === 'admin') return role === 'admin';
  return false;
}
