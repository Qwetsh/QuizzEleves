import { motion } from 'framer-motion';

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const contentVariants = {
  hidden: { opacity: 0, scale: 0.85, y: 30 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.9, y: -20 },
};

/**
 * Animated modal overlay wrapper.
 * Usage:
 *   <AnimatePresence>
 *     {showModal && (
 *       <ModalOverlay onClose={close}>
 *         <div>content</div>
 *       </ModalOverlay>
 *     )}
 *   </AnimatePresence>
 */
export default function ModalOverlay({ children, onClose, className = 'max-w-lg' }) {
  return (
    <motion.div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        className={`bg-[var(--paper)] rounded-2xl shadow-2xl w-full overflow-hidden ${className}`}
        variants={contentVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
