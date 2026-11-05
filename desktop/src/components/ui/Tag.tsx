import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

const tagVariants = cva(
  'inline-flex items-center gap-1.5 font-bold transition-all duration-120 ease-out select-none border',
  {
    variants: {
      variant: {
        default: 'bg-surface-container text-on-surface border-border-default',
        primary: 'bg-accent-blue/10 text-accent-blue border-accent-blue/30',
        secondary: 'bg-surface text-on-surface border-border-default shadow-xs',
        ai: 'bg-ai-purple/10 text-ai-purple border-ai-purple/30',
        success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
        error: 'bg-error/10 text-error border-error/30',
        outline: 'bg-transparent text-on-surface border-border-default',
      },
      size: {
        xs: 'h-5 px-1.5 text-[10px] tracking-wider uppercase rounded-[var(--radius-tag)]',
        sm: 'h-5.5 px-2 text-[11px] rounded-[var(--radius-tag)]',
        md: 'h-6.5 px-2.5 text-xs rounded-[var(--radius-tag)]',
        lg: 'h-7.5 px-3 text-sm rounded-[var(--radius-standard)]',
      },
      interactive: {
        true: 'cursor-pointer hover:brightness-95 active:scale-95',
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
        className={cn(tagVariants({ variant, size, interactive: isInteractive }), className)}
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
            className="ml-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5 transition-colors"
            aria-label="Remove"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </span>
    );
  }
);

Tag.displayName = 'Tag';

export const Badge = Tag;
export type BadgeProps = TagProps;
