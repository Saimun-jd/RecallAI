import React, { useEffect } from 'react';
import { PublicNavbar } from './PublicNavbar';
import { PublicFooter } from './PublicFooter';

interface PublicLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function PublicLayout({ children, title, description }: PublicLayoutProps) {
  useEffect(() => {
    const fullTitle = title ? `${title} | Recall AI` : 'Recall AI — Turn Knowledge Into Long-Term Memory';
    document.title = fullTitle;

    if (description) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute('content', description);
    }
  }, [title, description]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-on-surface selection:bg-primary/20 selection:text-primary">
      {/* Accessibility Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 px-4 py-2 bg-primary text-white font-bold rounded-md border-2 border-border-default shadow-neo"
      >
        Skip to main content
      </a>

      {/* Global Public Header */}
      <PublicNavbar />

      {/* Main Content Area */}
      <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col focus:outline-none">
        {children}
      </main>

      {/* Global Public Footer */}
      <PublicFooter />
    </div>
  );
}
