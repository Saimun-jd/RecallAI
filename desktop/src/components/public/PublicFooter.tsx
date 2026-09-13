import React from 'react';
import { Link } from 'react-router-dom';
import { Brain, ShieldCheck, Cpu, HardDrive, Lock, ArrowUpRight } from 'lucide-react';

export function PublicFooter() {
  return (
    <footer className="border-t-2 border-border-default bg-surface mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          {/* Brand Column */}
          <div className="space-y-4 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center border-2 border-border-default shadow-neo-sm">
                <Brain size={18} className="stroke-[2.5]" />
              </div>
              <span className="font-extrabold text-lg tracking-tight text-on-surface">Recall AI</span>
            </Link>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              Turn your knowledge into something you can actually remember. Grounded AI synthesis, interactive flashcards, and FSRS spaced repetition.
            </p>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-border-default bg-surface-container text-xs font-semibold text-on-surface">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Core Engine Operational</span>
            </div>
          </div>

          {/* Product Column */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-on-surface">Product</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/how-it-works" className="text-on-surface-variant hover:text-primary transition-colors font-medium">
                  How It Works
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-on-surface-variant hover:text-primary transition-colors font-medium">
                  Plans & Pricing
                </Link>
              </li>
              <li>
                <Link to="/app" className="text-on-surface-variant hover:text-primary transition-colors font-medium flex items-center gap-1">
                  <span>Open Library</span>
                  <ArrowUpRight size={13} />
                </Link>
              </li>
              <li>
                <Link to="/app/review" className="text-on-surface-variant hover:text-primary transition-colors font-medium flex items-center gap-1">
                  <span>Spaced Review</span>
                  <ArrowUpRight size={13} />
                </Link>
              </li>
            </ul>
          </div>

          {/* Trust & Architecture */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-on-surface">Trust & Security</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/security" className="text-on-surface-variant hover:text-primary transition-colors font-medium">
                  Security Architecture
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-on-surface-variant hover:text-primary transition-colors font-medium">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-on-surface-variant hover:text-primary transition-colors font-medium">
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
            <div className="space-y-2 text-xs text-on-surface-variant leading-relaxed">
              <p className="flex items-start gap-1.5">
                <Lock size={14} className="text-primary mt-0.5 shrink-0" />
                <span><strong>Zero Model Training:</strong> Your documents are never used to train third-party AI models.</span>
              </p>
              <p className="flex items-start gap-1.5">
                <Cpu size={14} className="text-primary mt-0.5 shrink-0" />
                <span><strong>BYOK Ready:</strong> Direct connection to OpenAI, Gemini, or Groq with your personal API keys.</span>
              </p>
              <p className="flex items-start gap-1.5">
                <HardDrive size={14} className="text-primary mt-0.5 shrink-0" />
                <span><strong>Local-First:</strong> Fast desktop indexing with optional encrypted cloud backup.</span>
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
            <Link to="/security" className="hover:text-on-surface transition-colors">Security</Link>
            <Link to="/privacy" className="hover:text-on-surface transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-on-surface transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
