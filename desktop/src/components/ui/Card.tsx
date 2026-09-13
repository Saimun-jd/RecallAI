import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const cardVariants = cva(
  'bg-surface border-2 border-border-default transition-all duration-150 ease-out text-on-surface',
  {
    variants: {
      variant: {
        default: 'shadow-neo-sm',
        elevated: 'shadow-neo',
        interactive: 'shadow-neo-sm hover:shadow-neo hover:-translate-x-[1px] hover:-translate-y-[1px] cursor-pointer',
        flat: 'shadow-none',
        ai: 'border-ai-purple/30 shadow-neo-sm bg-gradient-to-b from-ai-purple/5 to-transparent',
      },
      size: {
        sm: 'p-3.5 rounded-[var(--radius-standard)]',
        md: 'p-5 rounded-[var(--radius-large)]',
        lg: 'p-6 sm:p-8 rounded-[var(--radius-large)]',
        none: 'p-0 rounded-[var(--radius-large)]',
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
        className={cn(cardVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5 pb-3', className)}
      {...props}
    />
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-base sm:text-lg font-bold tracking-tight text-on-surface', className)}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-xs sm:text-sm font-medium text-on-surface-variant', className)}
      {...props}
    />
  )
);
CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center pt-4 mt-auto border-t border-border-default/60', className)}
      {...props}
    />
  )
);
CardFooter.displayName = 'CardFooter';
