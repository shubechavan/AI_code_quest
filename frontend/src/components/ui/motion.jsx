/**
 * Shared motion primitives (Framer Motion).
 *
 * Deliberately restrained: a short fade-up on page mount and a small stagger for lists of
 * cards. No bouncing, spinning, or attention-seeking motion — the goal is to make the UI
 * feel responsive and intentional, not animated for its own sake. Durations are kept under
 * ~250ms so the interface never feels slow.
 */
import { motion } from 'framer-motion';

export const fadeUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: 'easeOut' },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.04 } },
};

/** Wrap a routed page so its content fades in on navigation. */
export function PageTransition({ children, className = '' }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

/** Container that staggers the entrance of its MotionItem children. */
export function MotionList({ children, className = '' }) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {children}
    </motion.div>
  );
}

export function MotionItem({ children, className = '' }) {
  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  );
}

export { motion };
