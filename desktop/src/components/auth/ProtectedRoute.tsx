import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Brain } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}

export function ProtectedRoute({ children, requireOnboarding = true }: ProtectedRouteProps) {
  const { status, onboardingCompleted } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="p-8 rounded-2xl border-2 border-border-default bg-surface shadow-neo max-w-sm w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center border-2 border-border-default shadow-neo-sm mx-auto animate-pulse">
            <Brain size={24} className="stroke-[2.5]" />
          </div>
          <div className="space-y-1">
            <h3 className="font-extrabold text-base text-on-surface">Recall AI</h3>
            <p className="text-xs text-on-surface-variant font-medium">Verifying authenticated session...</p>
          </div>
          <div className="w-full bg-surface-container-high rounded-full h-2 border border-border-default overflow-hidden">
            <div className="bg-primary h-full w-2/3 animate-[shimmer_1.5s_infinite]" />
          </div>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    const destination = location.pathname + location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(destination)}`} replace />;
  }

  // If user has not completed onboarding and onboarding is required, redirect to /onboarding
  if (requireOnboarding && !onboardingCompleted && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // If user has completed onboarding and is visiting /onboarding, send them to workspace
  if (!requireOnboarding && onboardingCompleted && location.pathname === '/onboarding') {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
