import type { Variants, Transition } from 'framer-motion'

/**
 * Standard easing and spring transition configurations
 * following Google Antigravity aesthetic guidelines.
 */
export const springTransition: Transition = {
  type: 'spring',
  damping: 28,
  stiffness: 420,
  mass: 0.8
}

export const smoothSpring: Transition = {
  type: 'spring',
  damping: 32,
  stiffness: 480,
  mass: 0.7
}

export const easeOutTransition: Transition = {
  duration: 0.15,
  ease: [0.16, 1, 0.3, 1]
}

export const easeInTransition: Transition = {
  duration: 0.1,
  ease: [0.7, 0, 0.84, 0]
}

/**
 * Modal backdrop fade animation
 */
export const modalBackdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.18, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.14, ease: 'easeIn' } }
}

/**
 * Modal dialog card pop and spring elevation
 */
export const modalCardVariants: Variants = {
  initial: { opacity: 0, scale: 0.94, y: 12 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springTransition
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 6,
    transition: { duration: 0.12, ease: 'easeIn' }
  }
}

/**
 * Menu and titlebar dropdown animations
 */
export const dropdownVariants: Variants = {
  initial: { opacity: 0, y: -6, scale: 0.97 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.14, ease: [0.16, 1, 0.3, 1] }
  },
  exit: {
    opacity: 0,
    y: -4,
    scale: 0.98,
    transition: { duration: 0.1, ease: 'easeIn' }
  }
}

/**
 * Floating submenu flyout animation
 */
export const submenuVariants: Variants = {
  initial: { opacity: 0, x: -6, scale: 0.98 },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.14, ease: [0.16, 1, 0.3, 1] }
  },
  exit: {
    opacity: 0,
    x: -4,
    scale: 0.98,
    transition: { duration: 0.1, ease: 'easeIn' }
  }
}

/**
 * Search bar floating entry animation
 */
export const searchBarVariants: Variants = {
  initial: { opacity: 0, y: -14, scale: 0.95 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springTransition
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.96,
    transition: { duration: 0.12, ease: 'easeIn' }
  }
}

/**
 * Context menu and popup animation
 */
export const contextMenuVariants: Variants = {
  initial: { opacity: 0, scale: 0.94 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.12, ease: [0.16, 1, 0.3, 1] }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.08, ease: 'easeIn' }
  }
}

/**
 * Suggestion dropdown autocomplete box animation
 */
export const suggestionDropdownVariants: Variants = {
  initial: { opacity: 0, y: 4, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.12, ease: 'easeOut' }
  },
  exit: {
    opacity: 0,
    y: 2,
    scale: 0.98,
    transition: { duration: 0.08, ease: 'easeIn' }
  }
}

/**
 * Tab strip item enter / exit animation
 */
export const tabItemVariants: Variants = {
  initial: { opacity: 0, scale: 0.9, width: 0 },
  animate: {
    opacity: 1,
    scale: 1,
    width: 'auto',
    transition: smoothSpring
  },
  exit: {
    opacity: 0,
    scale: 0.85,
    width: 0,
    transition: { duration: 0.14, ease: 'easeIn' }
  }
}
