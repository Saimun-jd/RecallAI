import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface PublicOnlyRouteProps {
  children: React.ReactNode;
}

export const getSafeRedirectUrl = (search: string, fallback: string = '/app'): string => {
  try {
    const params = new URLSearchParams(search);
    const redirect = params.get('redirect');
    if (!redirect) return fallback;

    // Security check: Must start with single slash, prevent open redirects
    if (redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.includes(':')) {
      return redirect;
    }
  } catch {
    // Fallback if parsing fails
  }
  return fallback;
};

export function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const { status, onboardingCompleted } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'authenticated') {
    if (!onboardingCompleted) {
      return <Navigate to="/onboarding" replace />;
    }
    const safeTarget = getSafeRedirectUrl(location.search, '/app');
    return <Navigate to={safeTarget} replace />;
  }

  return <>{children}</>;
}
