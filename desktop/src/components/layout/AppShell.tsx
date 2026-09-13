import React, { useState } from 'react';
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

  return (
    <div className={cn('flex flex-col h-screen bg-background text-on-surface font-sans antialiased overflow-hidden', className)}>
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
      <div className="flex relative w-full flex-row flex-1 h-[calc(100vh-60px)] overflow-hidden">
        {/* Persistent Desktop Sidebar (hidden on mobile) */}
        <div className="hidden md:flex shrink-0">
          <Sidebar />
        </div>

        {/* Main Viewport */}
        <main className="flex-1 flex flex-col bg-background relative min-w-0 overflow-y-auto pb-16 md:pb-0 focus:outline-none">
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
