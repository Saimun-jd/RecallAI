import React from 'react';
import { Link } from 'react-router-dom';
import { Cpu, HardDrive, Lock, ArrowUpRight } from 'lucide-react';
import { RecallLogo } from '../brand/RecallLogo';

export function PublicFooter() {
  return (
    <footer className="border-t-2 border-border-default bg-surface mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-12">
          {/* Brand Column */}
          <div className="space-y-4 sm:col-span-2 lg:col-span-1">
            <Link to="/" className="inline-flex items-center" aria-label="Recall AI Home">
              <RecallLogo size="md" showAiBadge />
            </Link>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed max-w-sm">
              Turn your knowledge into long-term recall. Grounded AI synthesis, interactive study cards, and FSRS spaced repetition.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border-default bg-surface-container text-xs font-semibold text-on-surface">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Core Engine Operational</span>
            </div>
          </div>

          {/* Product Column */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-on-surface">Product</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/how-it-works" className="text-on-surface-variant hover:text-primary transition-colors font-medium inline-block py-1">
                  How It Works
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-on-surface-variant hover:text-primary transition-colors font-medium inline-block py-1">
                  Plans & Pricing
                </Link>
              </li>
              <li>
                <Link to="/app" className="text-on-surface-variant hover:text-primary transition-colors font-medium inline-flex items-center gap-1 py-1">
                  <span>Open Workspace</span>
                  <ArrowUpRight size={13} />
                </Link>
              </li>
              <li>
                <Link to="/app/review" className="text-on-surface-variant hover:text-primary transition-colors font-medium inline-flex items-center gap-1 py-1">
                  <span>Spaced Review</span>
                  <ArrowUpRight size={13} />
                </Link>
              </li>
            </ul>
          </div>

          {/* Trust & Security */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-on-surface">Trust & Security</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/security" className="text-on-surface-variant hover:text-primary transition-colors font-medium inline-block py-1">
                  Security Architecture
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-on-surface-variant hover:text-primary transition-colors font-medium inline-block py-1">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-on-surface-variant hover:text-primary transition-colors font-medium inline-block py-1">
                  Terms of Service
                </Link>
              </li>
              <li>
                <span className="text-xs text-on-surface-variant/80 block mt-1">
                  AES-256 GCM Keyring Protection
                </span>
              </li>
            </ul>
          </div>

          {/* Capabilities */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-on-surface">Capabilities</h3>
            <div className="space-y-2.5 text-xs text-on-surface-variant leading-relaxed">
              <p className="flex items-start gap-2">
                <Lock size={15} className="text-primary mt-0.5 shrink-0" />
                <span><strong className="text-on-surface">Zero Model Training:</strong> Documents are never used to train external models.</span>
              </p>
              <p className="flex items-start gap-2">
                <Cpu size={15} className="text-primary mt-0.5 shrink-0" />
                <span><strong className="text-on-surface">BYOK Ready:</strong> Direct connection to OpenAI, Gemini, or Groq with your keys.</span>
              </p>
              <p className="flex items-start gap-2">
                <HardDrive size={15} className="text-primary mt-0.5 shrink-0" />
                <span><strong className="text-on-surface">Local-First:</strong> Fast local desktop indexing with optional cloud sync.</span>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-border-default/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-on-surface-variant">
          <div>
            &copy; {new Date().getFullYear()} Recall AI. Built for serious learners, researchers, and professionals.
          </div>
          <div className="flex items-center gap-6">
            <Link to="/security" className="hover:text-on-surface transition-colors py-1">Security</Link>
            <Link to="/privacy" className="hover:text-on-surface transition-colors py-1">Privacy</Link>
            <Link to="/terms" className="hover:text-on-surface transition-colors py-1">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
