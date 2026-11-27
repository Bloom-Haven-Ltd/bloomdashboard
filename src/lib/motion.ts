/**
 * Centralized motion language for Bloom Haven Health.
 *
 * All durations sit in the 150–260ms range using transform and opacity only
 * for 60fps performance. Wrapped in <MotionConfig reducedMotion="user">
 * via MotionProvider so OS reduced-motion preferences are respected globally.
 */

import type { Transition, Variants } from 'framer-motion';

export const MOTION_EASE = [0.22, 1, 0.36, 1] as const;

export const MOTION_TRANSITION: Transition = {
  duration: 0.22,
  ease: MOTION_EASE,
};

export const FAST_TRANSITION: Transition = {
  duration: 0.16,
  ease: MOTION_EASE,
};

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: MOTION_EASE },
  },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04,
    },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: MOTION_EASE },
  },
};

export const dropdownVariants: Variants = {
  initial: { opacity: 0, y: 6, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.16, ease: MOTION_EASE },
  },
  exit: {
    opacity: 0,
    y: 4,
    scale: 0.98,
    transition: { duration: 0.12, ease: MOTION_EASE },
  },
};
