import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Brain, ArrowRight, Menu, X, ShieldCheck, Sparkles, BookOpen } from 'lucide-react';
import { ThemeToggle } from '../../hooks/useTheme';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';

interface PublicNavbarProps {
  onLaunchApp?: () => void;
}

export function PublicNavbar({ onLaunchApp }: PublicNavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { status } = useAuth();

  const navLinks = [
    { label: 'How It Works', path: '/how-it-works' },
    { label: 'Pricing', path: '/pricing' },
    { label: 'Security', path: '/security' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 w-full bg-surface/90 backdrop-blur-md border-b-2 border-border-default">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link 
          to="/" 
          className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg py-1"
          aria-label="Recall AI Home"
        >
          <div className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center border-2 border-border-default shadow-neo-sm group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:shadow-none transition-all">
            <Brain size={20} className="stroke-[2.5]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-lg sm:text-xl tracking-tight text-on-surface">Recall AI</span>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-surface-container border border-border-default rounded-md text-on-surface-variant">
              Desktop & Web
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Public Navigation">
          {navLinks.map((link) => {
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-bold transition-all border ${
                  active
                    ? 'bg-surface-container-high border-border-default text-on-surface shadow-neo-sm'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          {status === 'authenticated' ? (
            <Link to="/app">
              <Button 
                variant="primary" 
                size="sm" 
                className="gap-2 font-bold shadow-neo hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-neo-sm active:translate-x-1 active:translate-y-1 active:shadow-none"
                onClick={onLaunchApp}
              >
                <span>Open Workspace</span>
                <ArrowRight size={15} className="stroke-[2.5]" />
              </Button>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="font-bold text-on-surface hover:bg-surface-container"
                >
                  Log in
                </Button>
              </Link>
              <Link to="/register">
                <Button 
                  variant="primary" 
                  size="sm" 
                  className="gap-1.5 font-bold shadow-neo hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-neo-sm active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  <span>Get Started</span>
                  <ArrowRight size={14} className="stroke-[2.5]" />
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Controls */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg border-2 border-border-default bg-surface hover:bg-surface-container text-on-surface focus:outline-none focus:ring-2 focus:ring-primary shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b-2 border-border-default bg-surface px-4 pt-3 pb-6 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col gap-1.5" aria-label="Mobile Navigation">
            {navLinks.map((link) => {
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-bold border-2 transition-all ${
                    active
                      ? 'bg-surface-container-high border-border-default text-on-surface shadow-neo-sm'
                      : 'border-border-default bg-surface text-on-surface hover:bg-surface-container shadow-neo-sm'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="pt-2 flex flex-col gap-2">
            {status === 'authenticated' ? (
              <Link 
                to="/app" 
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onLaunchApp) onLaunchApp();
                }}
                className="w-full"
              >
                <Button variant="primary" size="md" className="w-full justify-center gap-2 font-bold shadow-neo">
                  <span>Open Workspace</span>
                  <ArrowRight size={16} className="stroke-[2.5]" />
                </Button>
              </Link>
            ) : (
              <>
                <Link 
                  to="/login" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full"
                >
                  <Button variant="outline" size="md" className="w-full justify-center font-bold border-2 border-border-default shadow-neo-sm">
                    Log in
                  </Button>
                </Link>
                <Link 
                  to="/register" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full"
                >
                  <Button variant="primary" size="md" className="w-full justify-center gap-2 font-bold shadow-neo">
                    <span>Get Started Free</span>
                    <ArrowRight size={16} className="stroke-[2.5]" />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
