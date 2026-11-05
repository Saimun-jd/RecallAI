import { type Transition, type Variants } from 'framer-motion';

/**
 * Recall AI Motion System
 * Designed specifically for Neo-Brutalist and Academic Precision UI:
 * - Tactile, decisive, and confident
 * - Snappy springs and zero mushy bouncing
 * - Static by default, animated when motion communicates state or hierarchy
 * - Full reduced-motion awareness
 */

// Timing scale
export const DURATION = {
  fast: 0.14,
  medium: 0.22,
  slow: 0.38,
} as const;

// Easing curves
export const EASING = {
  // Snappy deceleration curve for UI panels, drawers, and card reveals
  snap: [0.16, 1, 0.3, 1] as [number, number, number, number],
  // Smooth subtle ease for overlays
  smooth: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
};

// Physics springs
export const SPRINGS = {
  // For physical Neo-Brutalist buttons & switches: high stiffness, high damping
  tactile: {
    type: 'spring',
    stiffness: 450,
    damping: 28,
    mass: 0.8,
  } as Transition,

  // For modal dialogs and alert pop-ins: stable, decisive arrival
  dialog: {
    type: 'spring',
    stiffness: 380,
    damping: 26,
    mass: 0.9,
  } as Transition,

  // For small chip/badge micro-interactions
  pop: {
    type: 'spring',
    stiffness: 500,
    damping: 22,
  } as Transition,
};

// Transitions
export const TRANSITIONS = {
  fast: { duration: DURATION.fast, ease: EASING.snap },
  medium: { duration: DURATION.medium, ease: EASING.snap },
  slow: { duration: DURATION.slow, ease: EASING.snap },
  instant: { duration: 0 },
};

// Motion Variants with built-in accessibility & reduced motion safety
export const FADE_IN: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: TRANSITIONS.fast },
  exit: { opacity: 0, transition: TRANSITIONS.fast },
};

export const FADE_UP: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: TRANSITIONS.medium },
  exit: { opacity: 0, y: -6, transition: TRANSITIONS.fast },
};

export const FADE_DOWN: Variants = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0, transition: TRANSITIONS.medium },
  exit: { opacity: 0, y: 6, transition: TRANSITIONS.fast },
};

export const SCALE_IN: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: SPRINGS.dialog },
  exit: { opacity: 0, scale: 0.96, transition: TRANSITIONS.fast },
};

export const DIALOG_VARIANTS: Variants = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: SPRINGS.dialog },
  exit: { opacity: 0, scale: 0.97, y: 4, transition: TRANSITIONS.fast },
};

export const BACKDROP_VARIANTS: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: TRANSITIONS.fast },
  exit: { opacity: 0, transition: TRANSITIONS.fast },
};

export const DRAWER_LEFT_VARIANTS: Variants = {
  initial: { x: '-100%' },
  animate: { x: 0, transition: { duration: DURATION.medium, ease: EASING.snap } },
  exit: { x: '-100%', transition: { duration: DURATION.fast, ease: EASING.snap } },
};

export const STAGGER_CONTAINER: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.02,
    },
  },
};

export const STAGGER_ITEM: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: TRANSITIONS.medium,
  },
};

// Reduced Motion fallbacks
export const REDUCED_VARIANTS = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.01 } },
    exit: { opacity: 0, transition: { duration: 0.01 } },
  },
  dialog: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.01 } },
    exit: { opacity: 0, transition: { duration: 0.01 } },
  },
  none: {
    initial: {},
    animate: {},
    exit: {},
  },
};
