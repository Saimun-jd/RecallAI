import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const inputVariants = cva(
  'w-full bg-surface border-2 border-border-default text-on-surface font-medium transition-all duration-120 ease-out placeholder:text-on-surface-variant/60 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary',
  {
    variants: {
      size: {
        sm: 'h-8 px-3 text-xs rounded-[var(--radius-standard)]',
        md: 'h-10 px-3.5 text-sm rounded-[var(--radius-standard)]',
        lg: 'h-12 px-4 text-base rounded-[var(--radius-standard)]',
      },
      variant: {
        default: 'border-border-default hover:border-border-hover',
        error: 'border-error focus-visible:ring-error focus-visible:border-error text-error',
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
    VariantProps<typeof inputVariants> {
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  error?: string;
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, size, variant, type = 'text', leftIcon, rightIcon, error, label, id, ...props }, ref) => {
    const inputElement = (
      <div className="relative flex items-center w-full">
        {leftIcon && (
          <div className="absolute left-3 flex items-center justify-center text-on-surface-variant pointer-events-none">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={id}
          type={type}
          className={cn(
            inputVariants({ size, variant: error ? 'error' : variant }),
            leftIcon ? 'pl-9' : '',
            rightIcon ? 'pr-9' : '',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 flex items-center justify-center text-on-surface-variant">
            {rightIcon}
          </div>
        )}
      </div>
    );

    if (!label && !error) {
      return inputElement;
    }

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={id} className="text-xs font-bold uppercase tracking-wider text-on-surface">
            {label}
          </label>
        )}
        {inputElement}
        {error && (
          <span className="text-xs font-semibold text-error mt-0.5">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
