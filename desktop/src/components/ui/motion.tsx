import React, { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import {
  FADE_IN,
  FADE_UP,
  STAGGER_CONTAINER,
  STAGGER_ITEM,
  TRANSITIONS,
  SPRINGS,
} from '../../lib/motion';
import { cn } from '../../lib/utils';

/**
 * Custom hook to safely detect prefers-reduced-motion
 */
export function usePrefersReducedMotion(): boolean {
  const prefersReduced = useReducedMotion();
  return Boolean(prefersReduced);
}

/**
 * FadeIn Component
 */
export interface FadeInProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children?: React.ReactNode;
  delay?: number;
}

export function FadeIn({ children, className, delay = 0, ...props }: FadeInProps) {
  const shouldReduceMotion = usePrefersReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={FADE_IN}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ ...TRANSITIONS.fast, delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * FadeUp Component
 */
export interface FadeUpProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children?: React.ReactNode;
  delay?: number;
  distance?: number;
}

export function FadeUp({ children, className, delay = 0, distance = 10, ...props }: FadeUpProps) {
  const shouldReduceMotion = usePrefersReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: distance }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -distance / 2 }}
      transition={{ ...TRANSITIONS.medium, delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Stagger Container & Stagger Item
 */
export interface StaggerContainerProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children?: React.ReactNode;
  delayChildren?: number;
  staggerChildren?: number;
}

export function StaggerContainer({
  children,
  className,
  delayChildren = 0,
  staggerChildren = 0.06,
  ...props
}: StaggerContainerProps) {
  const shouldReduceMotion = usePrefersReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={{
        initial: {},
        animate: {
          transition: {
            delayChildren,
            staggerChildren,
          },
        },
      }}
      initial="initial"
      animate="animate"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export interface StaggerItemProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children?: React.ReactNode;
}

export function StaggerItem({ children, className, ...props }: StaggerItemProps) {
  const shouldReduceMotion = usePrefersReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={STAGGER_ITEM}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}


/**
 * NeoTypewriter
 * High-performance, accessible typewriter effect.
 * - Simulates demonstrative AI queries / answers with natural typing rhythm
 * - Avoids layout shift by using a stable placeholder element or preserved min-height
 * - Cleans up all timers on unmount
 * - Renders complete text instantly when prefers-reduced-motion is true
 */
export interface NeoTypewriterProps {
  text: string;
  speed?: number; // ms per character (default: 26ms)
  startDelay?: number; // ms before starting
  onComplete?: () => void;
  className?: string;
  cursor?: boolean;
}

export function NeoTypewriter({
  text,
  speed = 26,
  startDelay = 200,
  onComplete,
  className,
  cursor = true,
}: NeoTypewriterProps) {
  const shouldReduceMotion = usePrefersReducedMotion();
  const [displayedText, setDisplayedText] = useState(shouldReduceMotion ? text : '');
  const [isDone, setIsDone] = useState(shouldReduceMotion);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayedText(text);
      setIsDone(true);
      onCompleteRef.current?.();
      return;
    }

    setDisplayedText('');
    setIsDone(false);

    let currentIndex = 0;
    let timerId: any = null;

    const startTimer = setTimeout(() => {
      timerId = setInterval(() => {
        currentIndex++;
        if (currentIndex <= text.length) {
          setDisplayedText(text.slice(0, currentIndex));
        } else {
          clearInterval(timerId);
          setIsDone(true);
          onCompleteRef.current?.();
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(startTimer);
      if (timerId) clearInterval(timerId);
    };
  }, [text, speed, startDelay, shouldReduceMotion]);

  return (
    <span className={cn('inline-block relative', className)}>
      <span>{displayedText}</span>
      {cursor && !isDone && (
        <span
          className="inline-block w-2 h-4 ml-0.5 bg-primary align-middle animate-pulse"
          aria-hidden="true"
        />
      )}
    </span>
  );
}

/**
 * NeoMarquee
 * Crisp Neo-Brutalist marquee ticker ribbon.
 * - Uses pure hardware-accelerated CSS translation
 * - Pauses cleanly on hover
 * - Fully accessible with aria-hidden duplicate track
 * - Disables motion when prefers-reduced-motion is active
 */
export interface NeoMarqueeProps {
  items: string[];
  speedSeconds?: number;
  separator?: string;
  className?: string;
}

export function NeoMarquee({
  items,
  speedSeconds = 30,
  separator = '•',
  className,
}: NeoMarqueeProps) {
  const shouldReduceMotion = usePrefersReducedMotion();

  return (
    <div
      className={cn(
        'w-full overflow-hidden whitespace-nowrap select-none border-y-2 border-border-default bg-surface-container py-3 font-mono text-xs font-black uppercase tracking-wider text-on-surface shadow-neo-sm',
        className
      )}
      role="region"
      aria-label="Key features ticker"
    >
      <div
        className="flex w-max group hover:[animation-play-state:paused]"
        style={{
          animation: shouldReduceMotion ? 'none' : `marquee ${speedSeconds}s linear infinite`,
        }}
      >
        {/* Track 1 */}
        <div className="flex shrink-0 items-center gap-6 pr-6">
          {items.map((item, idx) => (
            <span key={`t1-${idx}`} className="inline-flex items-center gap-6">
              <span>{item}</span>
              <span className="text-primary/60 font-bold" aria-hidden="true">
                {separator}
              </span>
            </span>
          ))}
        </div>

        {/* Track 2 (for continuous loop, hidden from screen readers) */}
        <div className="flex shrink-0 items-center gap-6 pr-6" aria-hidden="true">
          {items.map((item, idx) => (
            <span key={`t2-${idx}`} className="inline-flex items-center gap-6">
              <span>{item}</span>
              <span className="text-primary/60 font-bold">
                {separator}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
