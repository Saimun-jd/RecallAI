import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TopBar } from './TopBar';
import { Sidebar } from '../Sidebar';
import { MobileNav } from './MobileNav';
import { CommandPalette } from '../CommandPalette';
import { cn } from '../../lib/utils';

export interface AppShellProps {
  user?: any;
  bootTime?: number;
  sidecarStatus?: string;
  className?: string;
  children: React.ReactNode;
}

export function AppShell({
  user,
  bootTime = Date.now(),
  sidecarStatus = 'connected',
  className,
  children,
}: AppShellProps) {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const location = useLocation();

  const isFullHeightView =
    location.pathname.startsWith('/chat') ||
    location.pathname.startsWith('/app/chat') ||
    location.pathname.startsWith('/books/') ||
    location.pathname.startsWith('/notes');

  return (
    <div className={cn('flex flex-col h-dvh bg-background text-on-surface font-sans antialiased overflow-hidden', className)}>
      {/* Global Command Palette (Cmd + K) */}
      <CommandPalette />

      {/* Persistent Global Top Bar */}
      <TopBar
        user={user}
        bootTime={bootTime}
        sidecarStatus={sidecarStatus}
        onMobileMenuOpen={() => setIsMobileDrawerOpen(true)}
      />

      {/* Center Row: Desktop Sidebar + Main Content Viewport */}
      <div className="flex relative w-full flex-row flex-1 min-h-0 overflow-hidden">
        {/* Persistent Desktop Sidebar (hidden on mobile) */}
        <div className="hidden md:flex shrink-0">
          <Sidebar />
        </div>

        {/* Main Viewport */}
        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            'flex-1 flex flex-col bg-background relative min-w-0 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0 focus:outline-none',
            isFullHeightView ? 'overflow-hidden' : 'overflow-y-auto'
          )}
        >
          {children}
        </main>
      </div>

      {/* Mobile Navigation: Sticky Bottom Bar + Slide-out Drawer */}
      <MobileNav
        user={user}
        isDrawerOpen={isMobileDrawerOpen}
        onCloseDrawer={() => setIsMobileDrawerOpen(false)}
      />
    </div>
  );
}
