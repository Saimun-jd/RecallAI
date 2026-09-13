import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  maxWidth = 'md',
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-150 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Window */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'dialog-title' : undefined}
        aria-describedby={description ? 'dialog-description' : undefined}
        className={cn(
          'relative w-full bg-surface border-2 border-border-default shadow-neo-lg rounded-[var(--radius-large)] z-10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150',
          maxWidthClasses,
          className
        )}
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border-default/70 bg-surface-container-low/40 shrink-0">
            <div className="space-y-1 pr-6">
              {title && (
                <h2 id="dialog-title" className="text-lg font-bold text-on-surface leading-snug">
                  {title}
                </h2>
              )}
              {description && (
                <p id="dialog-description" className="text-xs sm:text-sm text-on-surface-variant font-medium">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border-default bg-surface hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Close modal"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto overflow-x-hidden flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}

export function DialogFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex items-center justify-end gap-3 pt-4 mt-6 border-t border-border-default/60', className)}>
      {children}
    </div>
  );
}
