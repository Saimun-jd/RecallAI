import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ThemeToggle } from '../../hooks/useTheme';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { RecallLogo } from '../../components/brand';

export function ForgotPasswordView() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: `${window.location.origin}/#/reset-password`,
        });
      } else {
        // Mock / local development pause
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
      // Always show generic confirmation to prevent email enumeration
      setIsSubmitted(true);
    } catch {
      // Still show generic confirmation unless network completely failed
      setIsSubmitted(true);
    } finally {
      setIsLoading(false);
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

      {/* Main Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <div className="p-6 sm:p-8 rounded-2xl border-2 border-border-default bg-surface shadow-neo space-y-6">
            
            {/* Header */}
            <div className="space-y-2 text-center">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-on-surface">
                Reset your password
              </h1>
              <p className="text-xs sm:text-sm text-on-surface-variant font-medium">
                Enter your registered email address and we will send recovery instructions.
              </p>
            </div>

            {/* Success State */}
            {isSubmitted ? (
              <div className="p-5 rounded-xl border-2 border-primary/30 bg-primary/5 space-y-4 text-center animate-in fade-in-50 duration-200">
                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center mx-auto shadow-neo-sm">
                  <CheckCircle2 size={20} />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-sm font-black text-on-surface">Recovery link dispatched</h2>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    If an account is associated with <strong>{email}</strong>, you will receive an email shortly with instructions to reset your password.
                  </p>
                </div>
                <Link to="/login" className="block pt-2">
                  <Button variant="outline" size="md" className="w-full justify-center font-bold border-2 border-border-default shadow-neo-sm">
                    Return to login
                  </Button>
                </Link>
              </div>
            ) : (
              /* Request Form */
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {errorMessage && (
                  <div 
                    role="alert" 
                    className="p-3 rounded-xl border-2 border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold flex items-start gap-2 animate-in fade-in-50 duration-200"
                  >
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label 
                    htmlFor="forgot-email" 
                    className="block text-xs font-bold uppercase tracking-wider text-on-surface"
                  >
                    Email Address
                  </label>
                  <input
                    id="forgot-email"
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

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isLoading}
                  disabled={isLoading}
                  className="w-full justify-center font-extrabold shadow-neo mt-2"
                >
                  <span>{isLoading ? 'Sending instructions...' : 'Send Recovery Link'}</span>
                </Button>

                <div className="pt-2 text-center">
                  <Link 
                    to="/login" 
                    className="text-xs font-bold text-on-surface-variant hover:text-on-surface inline-flex items-center gap-1.5"
                  >
                    <ArrowLeft size={14} />
                    <span>Back to login</span>
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
