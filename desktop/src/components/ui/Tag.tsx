import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';

const tagVariants = cva(
  // Base styles - 4px radius with label-sm typography
  'inline-flex items-center gap-1 font-medium transition-all duration-150 ease-out',
  {
    variants: {
      variant: {
        default: 'bg-surface-container text-on-surface border border-outline-variant',
        primary: 'bg-primary/10 text-primary border border-primary/20',
        secondary: 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20',
        ai: 'bg-ai-purple/10 text-ai-purple border border-ai-purple/20',
        success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        warning: 'bg-amber-50 text-amber-700 border border-amber-200',
        error: 'bg-error-container text-on-error-container border border-error/20',
      },
      size: {
        sm: 'h-5 px-2 text-[11px] rounded-[var(--radius-tag)]',
        md: 'h-6 px-2.5 text-xs rounded-[var(--radius-tag)]',
        lg: 'h-7 px-3 text-sm rounded-[var(--radius-tag)]',
      },
      interactive: {
        true: 'cursor-pointer hover:brightness-95',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      interactive: false,
    },
  }
);

export interface TagProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof tagVariants> {
  onRemove?: () => void;
}

export const Tag = forwardRef<HTMLSpanElement, TagProps>(
  ({ className, variant, size, interactive, onRemove, children, onClick, ...props }, ref) => {
    const isInteractive = interactive || !!onClick || !!onRemove;

    return (
      <span
        ref={ref}
        className={tagVariants({ variant, size, interactive: isInteractive, className })}
        onClick={onClick}
        {...props}
      >
        {children}
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="ml-0.5 hover:bg-black/10 rounded-full p-0.5 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </span>
    );
  }
);

Tag.displayName = 'Tag';
