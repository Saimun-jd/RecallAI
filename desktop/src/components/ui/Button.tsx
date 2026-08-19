import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  // Base styles - Soft Minimalism
  'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 ease-out disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'bg-accent-blue text-white hover:bg-opacity-90 shadow-default hover:shadow-md',
        secondary: 'bg-transparent border border-border-default text-on-surface hover:bg-surface-container hover:border-border-hover',
        ghost: 'bg-transparent text-on-surface hover:bg-surface-container',
        ai: 'bg-gradient-to-r from-ai-purple/10 to-ai-purple/5 text-ai-purple border border-ai-purple/20 hover:bg-ai-purple/15',
        destructive: 'bg-error text-on-error hover:bg-opacity-90 shadow-default hover:shadow-md',
      },
      size: {
        sm: 'h-8 px-3 text-sm rounded-[var(--radius-standard)]',
        md: 'h-10 px-4 text-base rounded-[var(--radius-standard)]',
        lg: 'h-12 px-6 text-lg rounded-[var(--radius-standard)]',
        icon: 'h-10 w-10 rounded-[var(--radius-standard)]',
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
        className={buttonVariants({ variant, size, className })}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
