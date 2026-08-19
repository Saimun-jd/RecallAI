import { forwardRef, type InputHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const inputVariants = cva(
  // Base styles - Minimalist design with 1px border
  'w-full bg-surface-container-lowest border text-on-surface transition-all duration-150 ease-out placeholder:text-on-surface-variant disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      size: {
        sm: 'h-8 px-3 text-sm rounded-[var(--radius-standard)]',
        md: 'h-10 px-4 text-base rounded-[var(--radius-standard)]',
        lg: 'h-12 px-4 text-lg rounded-[var(--radius-standard)]',
      },
      variant: {
        default: 'border-border-default focus:border-accent-blue',
        error: 'border-error focus:border-error',
      },
    },
    defaultVariants: {
      size: 'md',
      variant: 'default',
    },
  }
);

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, size, variant, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={inputVariants({ size, variant, className })}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
