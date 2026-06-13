import { useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const contentVariants = {
  hidden: { opacity: 0, scale: 0.6, y: 30 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.9, y: -20 },
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ModalOverlay({ children, onClose, className = 'max-w-lg', panelStyle }) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;

    // Focus first focusable element inside modal
    const timer = requestAnimationFrame(() => {
      const el = dialogRef.current;
      if (!el) return;
      const first = el.querySelector(FOCUSABLE_SELECTOR);
      if (first) first.focus();
    });

    return () => {
      cancelAnimationFrame(timer);
      // Restore focus on unmount
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const el = dialogRef.current;
      if (!el) return;

      const focusable = Array.from(el.querySelectorAll(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(31,20,10,0.65), rgba(31,20,10,0.85))',
      }}
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      transition={{ duration: 0.2 }}
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        ref={dialogRef}
        className={`w-full overflow-hidden ${className}`}
        style={{
          maxHeight: '88vh',
          overflowY: 'auto',
          background: '#fffefb',
          borderRadius: 22,
          border: '1px solid rgba(122, 94, 58, 0.3)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
          ...panelStyle,
        }}
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
