import { Outlet } from 'react-router-dom';

export function ProtectedRoute() {
  // Bypass total para ambiente de sandbox
  return <Outlet />;
}
