import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-120 ease-out select-none disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-white border-2 border-border-default shadow-neo-sm hover:shadow-neo hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none',
        secondary:
          'bg-surface text-on-surface border-2 border-border-default shadow-neo-sm hover:bg-surface-container hover:shadow-neo hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none',
        outline:
          'bg-transparent text-on-surface border-2 border-border-default hover:bg-surface-container hover:border-border-hover',
        ghost:
          'bg-transparent text-on-surface hover:bg-surface-container border border-transparent',
        ai:
          'bg-gradient-to-r from-ai-purple/15 to-ai-purple/5 text-ai-purple border-2 border-ai-purple/30 shadow-neo-sm hover:border-ai-purple hover:shadow-neo hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none',
        destructive:
          'bg-error text-on-error border-2 border-border-default shadow-neo-sm hover:shadow-neo hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none',
      },
      size: {
        xs: 'h-7 px-2.5 text-xs rounded-[var(--radius-standard)]',
        sm: 'h-8 px-3 text-sm rounded-[var(--radius-standard)]',
        md: 'h-10 px-4 text-sm rounded-[var(--radius-standard)]',
        lg: 'h-12 px-6 text-base rounded-[var(--radius-standard)]',
        icon: 'h-9 w-9 p-0 rounded-[var(--radius-standard)]',
        'icon-sm': 'h-7 w-7 p-0 rounded-[var(--radius-standard)]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
