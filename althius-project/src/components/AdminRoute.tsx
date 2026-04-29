import { Outlet } from 'react-router-dom';

export function AdminRoute() {
  // Bypass total para ambiente de sandbox
  return <Outlet />;
}
