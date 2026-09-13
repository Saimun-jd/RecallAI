import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
  className?: string;
}

export function Breadcrumbs({ items, showHome = true, className }: BreadcrumbsProps) {
  const allItems: BreadcrumbItem[] = showHome
    ? [{ label: 'Dashboard', href: '/', icon: <Home size={14} /> }, ...items]
    : items;

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center overflow-x-auto hide-scrollbar', className)}>
      <ol className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-on-surface-variant">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;

          return (
            <li key={index} className="flex items-center gap-1.5 shrink-0">
              {index > 0 && (
                <ChevronRight size={13} className="text-on-surface-variant/40 shrink-0" aria-hidden="true" />
              )}
              {isLast || !item.href ? (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-1.5 truncate max-w-[200px] sm:max-w-xs',
                    isLast ? 'text-on-surface font-bold' : 'text-on-surface-variant'
                  )}
                >
                  {item.icon && <span className="shrink-0">{item.icon}</span>}
                  <span className="truncate">{item.label}</span>
                </span>
              ) : (
                <Link
                  to={item.href}
                  className="flex items-center gap-1.5 hover:text-primary transition-colors truncate max-w-[150px] sm:max-w-xs"
                >
                  {item.icon && <span className="shrink-0">{item.icon}</span>}
                  <span className="truncate">{item.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
