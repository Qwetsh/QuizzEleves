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

export default function ModalOverlay({ children, onClose, className = 'max-w-lg' }) {
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
    >
      <motion.div
        className={`w-full overflow-hidden ${className}`}
        style={{
          maxHeight: '88vh',
          overflowY: 'auto',
          background: '#fffefb',
          borderRadius: 22,
          border: '1px solid rgba(122, 94, 58, 0.3)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
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
