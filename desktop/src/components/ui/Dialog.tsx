import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BACKDROP_VARIANTS, DIALOG_VARIANTS, REDUCED_VARIANTS } from '../../lib/motion';
import { usePrefersReducedMotion } from './motion';

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
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const shouldReduceMotion = usePrefersReducedMotion();

  // Focus management and Escape key listener
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Initial focus on open
    const timer = setTimeout(() => {
      if (dialogRef.current) {
        const focusable = dialogRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.focus();
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
      previousActiveElement.current?.focus();
    };
  }, [isOpen, onClose]);

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[maxWidth];

  const backdropVariants = shouldReduceMotion ? REDUCED_VARIANTS.fadeIn : BACKDROP_VARIANTS;
  const modalVariants = shouldReduceMotion ? REDUCED_VARIANTS.dialog : DIALOG_VARIANTS;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal Dialog Window */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'dialog-title' : undefined}
            aria-describedby={description ? 'dialog-description' : undefined}
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn(
              'relative w-full bg-surface border-2 border-border-default shadow-neo-lg rounded-[var(--radius-large)] z-10 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]',
              maxWidthClasses,
              className
            )}
          >
            {/* Header */}
            {(title || description) && (
              <div className="flex items-start justify-between px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-border-default/70 bg-surface-container-low/40 shrink-0">
                <div className="space-y-1 pr-4 sm:pr-6">
                  {title && (
                    <h2 id="dialog-title" className="text-base sm:text-lg font-bold text-on-surface leading-snug">
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
                  className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border-2 border-border-default bg-surface hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-neo-xs hover:shadow-none active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {/* Body */}
            <div className="p-4 sm:p-6 overflow-y-auto overflow-x-hidden flex-1">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function DialogFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 sm:gap-3 pt-4 mt-6 border-t border-border-default/60', className)}>
      {children}
    </div>
  );
}
