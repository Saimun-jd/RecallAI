import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const cardVariants = cva(
  // Base styles - White background, 1px border, no shadow by default
  'bg-surface-container-lowest border transition-all duration-200 ease-out',
  {
    variants: {
      variant: {
        default: 'border-border-default hover:border-border-hover hover:shadow-default',
        flat: 'border-border-default',
        elevated: 'border-border-default shadow-default',
      },
      size: {
        sm: 'p-3 rounded-[var(--radius-standard)]',
        md: 'p-4 rounded-[var(--radius-large)]',
        lg: 'p-6 rounded-[var(--radius-large)]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cardVariants({ variant, size, className })}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';

// Card subcomponents for common patterns
export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={`flex flex-col space-y-1.5 ${className || ''}`}
      {...props}
    />
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={`text-headline-md font-semibold leading-none tracking-tight text-primary ${className || ''}`}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={`pt-0 ${className || ''}`} {...props} />
  )
);
CardContent.displayName = 'CardContent';
