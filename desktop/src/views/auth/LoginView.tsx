import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ThemeToggle } from '../../hooks/useTheme';
import { getSafeRedirectUrl } from '../../components/auth/PublicOnlyRoute';
import { isSupabaseConfigured } from '../../lib/supabase';
import { RecallLogo } from '../../components/brand';

export function LoginView() {
  const { status, login, loginWithGoogle, completeOnboarding } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Navigate immediately when authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      const target = getSafeRedirectUrl(location.search, '/app');
      navigate(target, { replace: true });
    }
  }, [status, location.search, navigate]);

  // Reset google loading state if user cancels or times out
  useEffect(() => {
    let timer: any;
    if (isGoogleLoading) {
      timer = setTimeout(() => {
        setIsGoogleLoading(false);
      }, 60000);
    }
    return () => clearTimeout(timer);
  }, [isGoogleLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      await login({ email: trimmedEmail, password });
      completeOnboarding();
      const target = getSafeRedirectUrl(location.search, '/app');
      navigate(target, { replace: true });
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to log in. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setIsGoogleLoading(true);
    try {
      completeOnboarding();
      await loginWithGoogle();
    } catch (err: any) {
      setErrorMessage(err.message || 'Google authentication failed. Please try email login.');
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-on-surface">
      {/* Top Bar with Home link & Theme Toggle */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center group" aria-label="Recall AI Home">
          <RecallLogo size="lg" showAiBadge />
        </Link>
        <ThemeToggle />
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <div className="p-6 sm:p-8 rounded-2xl border-2 border-border-default bg-surface shadow-neo space-y-6">
            
            {/* Header */}
            <div className="space-y-2 text-center">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-on-surface">
                Welcome back
              </h1>
              <p className="text-xs sm:text-sm text-on-surface-variant font-medium">
                Log in to resume your study sessions and reviews.
              </p>
            </div>

            {/* Error Alert */}
            {errorMessage && (
              <div 
                role="alert" 
                className="p-3.5 rounded-xl border-2 border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold flex items-start gap-2.5 animate-in fade-in-50 duration-200"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span className="leading-snug">{errorMessage}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label 
                  htmlFor="login-email" 
                  className="block text-xs font-bold uppercase tracking-wider text-on-surface"
                >
                  Email Address
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@university.edu"
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border-2 border-border-default bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label 
                    htmlFor="login-password" 
                    className="block text-xs font-bold uppercase tracking-wider text-on-surface"
                  >
                    Password
                  </label>
                  <Link 
                    to="/forgot-password" 
                    className="text-xs font-bold text-primary hover:underline focus:outline-none"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isLoading}
                    className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-lg border-2 border-border-default bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                disabled={isLoading}
                className="w-full justify-center font-extrabold shadow-neo mt-2"
              >
                <span>{isLoading ? 'Logging in...' : 'Log in'}</span>
                {!isLoading && <ArrowRight size={16} className="ml-1.5 stroke-[2.5]" />}
              </Button>
            </form>

            {/* Social / OAuth Login Divider */}
            {isSupabaseConfigured && (
              <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border-default/60" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-surface px-2 text-on-surface-variant font-bold text-[11px] tracking-wider">
                      Or continue with
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={handleGoogleLogin}
                  disabled={isGoogleLoading || isLoading}
                  isLoading={isGoogleLoading}
                  className="w-full justify-center font-bold border-2 border-border-default shadow-neo-sm hover:bg-surface-container gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Google</span>
                </Button>
              </>
            )}

            {/* Footer */}
            <div className="pt-2 text-center text-xs text-on-surface-variant font-medium">
              Don't have an account?{' '}
              <Link to="/register" className="font-extrabold text-primary hover:underline">
                Create one free
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
