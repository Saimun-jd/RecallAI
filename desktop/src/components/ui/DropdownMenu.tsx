import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import { cn } from '../../lib/utils';

interface DropdownContextType {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  close: () => void;
}

const DropdownContext = createContext<DropdownContextType | undefined>(undefined);

export interface DropdownMenuItemConfig {
  label: string;
  icon?: any;
  onClick: () => void;
  variant?: 'destructive' | 'danger' | 'default';
  disabled?: boolean;
}

export interface DropdownMenuProps {
  children?: React.ReactNode;
  trigger?: React.ReactNode;
  items?: DropdownMenuItemConfig[];
  align?: 'start' | 'end' | 'center';
}

export function DropdownMenu({ children, trigger, items, align = 'end' }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const close = () => setIsOpen(false);

  return (
    <DropdownContext.Provider value={{ isOpen, setIsOpen, close }}>
      <div ref={containerRef} className="relative inline-block text-left">
        {trigger && (
          <DropdownMenuTrigger asChild>
            {trigger}
          </DropdownMenuTrigger>
        )}
        {items && (
          <DropdownMenuContent align={align}>
            {items.map((item, index) => {
              const IconComponent = item.icon;
              return (
                <DropdownMenuItem
                  key={index}
                  onClick={item.onClick}
                  disabled={item.disabled}
                  destructive={item.variant === 'destructive' || item.variant === 'danger'}
                  icon={
                    IconComponent && (React.isValidElement(IconComponent) ? (
                      IconComponent
                    ) : typeof IconComponent === 'function' || typeof IconComponent === 'object' ? (
                      <IconComponent size={14} />
                    ) : null)
                  }
                >
                  {item.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        )}
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export function DropdownMenuTrigger({
  asChild,
  children,
  className,
}: {
  asChild?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const context = useContext(DropdownContext);
  if (!context) throw new Error('DropdownMenuTrigger must be used inside DropdownMenu');

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    context.setIsOpen((prev) => !prev);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
      'aria-expanded': context.isOpen,
      'aria-haspopup': true,
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-expanded={context.isOpen}
      aria-haspopup={true}
      className={className}
    >
      {children}
    </button>
  );
}

export function DropdownMenuContent({
  align = 'end',
  className,
  children,
  width = 'w-56',
}: {
  align?: 'start' | 'end' | 'center';
  className?: string;
  children: React.ReactNode;
  width?: string;
}) {
  const context = useContext(DropdownContext);
  if (!context) throw new Error('DropdownMenuContent must be used inside DropdownMenu');

  if (!context.isOpen) return null;

  const alignClasses = {
    start: 'left-0',
    end: 'right-0',
    center: 'left-1/2 -translate-x-1/2',
  }[align];

  return (
    <div
      role="menu"
      className={cn(
        'absolute z-50 mt-2 bg-surface border-2 border-border-default shadow-neo rounded-[var(--radius-large)] py-1.5 focus:outline-none animate-in fade-in zoom-in-95 duration-120',
        alignClasses,
        width,
        className
      )}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({
  onClick,
  disabled,
  destructive,
  icon,
  className,
  children,
}: {
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  destructive?: boolean;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const context = useContext(DropdownContext);

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    onClick?.(e);
    context?.close();
  };

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-left transition-colors',
        disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
        destructive
          ? 'text-error hover:bg-error/10'
          : 'text-on-surface hover:bg-surface-container',
        className
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate flex-1">{children}</span>
    </button>
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn('my-1.5 border-t border-border-default/70', className)} />;
}

export function DropdownMenuLabel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'px-3.5 py-1.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider',
        className
      )}
    >
      {children}
    </div>
  );
}
