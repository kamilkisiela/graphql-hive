import { useUser } from '@/components/auth/AuthProvider';
import React from 'react';

export const ManagerRoleGuard: React.FC<{
  children: React.ReactChild;
  renderError?: boolean;
}> = ({ children, renderError }) => {
  const { user } = useUser();

  if (user?.metadata?.admin) {
    return children as any;
  }

  if (renderError) {
    return <div>No Access</div>;
  }

  return null;
};
