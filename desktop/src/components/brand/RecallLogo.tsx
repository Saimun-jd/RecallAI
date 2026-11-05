import React from 'react';
import { cn } from '../../lib/utils';

export interface RecallLogoProps {
  /** Size tier for responsive scaling */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Whether to render a neo-brutalist 'AI' badge next to the wordmark */
  showAiBadge?: boolean;
  /** Whether to render 'AI' as plain styled text rather than a badge */
  showAiText?: boolean;
  /** Custom text color override (defaults to 'text-primary') */
  textColor?: string;
  /** Additional classes for the container */
  className?: string;
  /** Additional classes for the 3D 'R' logo image */
  imageClassName?: string;
  /** Additional classes for the 'ecall' text */
  textClassName?: string;
}

const SIZE_STYLES = {
  sm: {
    containerGap: 'gap-[1.5px]',
    image: 'h-[24px] sm:h-[26px] w-auto',
    text: 'text-[22px] sm:text-[24px]',
    aiBadge: 'text-[10px] px-1.5 py-0.5 ml-1.5',
    aiText: 'text-xs ml-1 font-bold',
  },
  md: {
    containerGap: 'gap-[2px]',
    image: 'h-[30px] sm:h-[33px] w-auto',
    text: 'text-[27px] sm:text-[30px]',
    aiBadge: 'text-[11px] sm:text-xs px-2 py-0.5 ml-2',
    aiText: 'text-sm sm:text-base ml-1.5 font-bold',
  },
  lg: {
    containerGap: 'gap-[2.5px]',
    image: 'h-[36px] sm:h-[38px] w-auto',
    text: 'text-[32px] sm:text-[34px]',
    aiBadge: 'text-xs px-2 py-0.5 ml-2',
    aiText: 'text-base sm:text-lg ml-2 font-bold',
  },
  xl: {
    containerGap: 'gap-[3px]',
    image: 'h-[44px] sm:h-[48px] w-auto',
    text: 'text-[40px] sm:text-[44px]',
    aiBadge: 'text-sm px-2.5 py-1 ml-2.5',
    aiText: 'text-xl ml-2.5 font-bold',
  },
};

/**
 * RecallLogo: Stylized wordmark brand identity.
 * The 3D logo icon acts as the initial capital letter 'R',
 * accompanied by optically tuned golden 'ecall' typography to form 'Recall'.
 */
export function RecallLogo({
  size = 'md',
  showAiBadge = false,
  showAiText = false,
  textColor,
  className,
  imageClassName,
  textClassName,
}: RecallLogoProps) {
  const styles = SIZE_STYLES[size] || SIZE_STYLES.md;
  const accessibleLabel = showAiBadge || showAiText ? 'Recall AI' : 'Recall';

  // User's exact golden color #F6D754 matching the logo's ribbon
  const goldenTextColor = 'text-[#F6D754]';

  return (
    <div
      role="img"
      aria-label={accessibleLabel}
      className={cn(
        'inline-flex items-center select-none shrink-0 group',
        styles.containerGap,
        className
      )}
    >
      {/* 3D App Icon Monogram serving as the initial letter 'R' */}
      <img
        src="/app-icon.png"
        srcSet="/app-icon-128.png 1x, /app-icon-256.png 2x, /app-icon.png 3x"
        alt=""
        aria-hidden="true"
        decoding="sync"
        loading="eager"
        className={cn(
          'object-contain shrink-0 transition-transform duration-200 group-hover:scale-105',
          styles.image,
          imageClassName
        )}
      />

      {/* Optically balanced golden 'ecall' completing 'Recall' */}
      <span
        aria-hidden="true"
        className={cn(
          'font-black font-sans leading-none tracking-[-0.035em]',
          styles.text,
          textColor || goldenTextColor,
          textClassName
        )}
        style={textColor ? undefined : { color: '#F6D754' }}
      >
        ecall
      </span>

      {/* Optional AI Neo-Brutalist Badge */}
      {showAiBadge && (
        <span
          aria-hidden="true"
          className={cn(
            'font-black uppercase tracking-wider rounded bg-[#F6D754]/15 text-[#bfa01a] dark:text-[#F6D754] border border-[#F6D754]/40 leading-none shadow-xs',
            styles.aiBadge
          )}
        >
          AI
        </span>
      )}

      {/* Optional AI Text */}
      {showAiText && (
        <span
          aria-hidden="true"
          className={cn(
            'font-bold tracking-normal leading-none',
            styles.aiText
          )}
          style={{ color: '#F6D754' }}
        >
          AI
        </span>
      )}
    </div>
  );
}
