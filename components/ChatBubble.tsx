import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatBubbleProps {
  message: string | null;
  onClose?: () => void;
  isThinking?: boolean;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message, onClose, isThinking }) => {
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (message && !isThinking) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // Auto-hide after 8 seconds
      timeoutRef.current = setTimeout(() => {
        if (onClose) onClose();
      }, 8000);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [message, isThinking, onClose]);

  if (!message && !isThinking) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.8 }}
        animate={{ opacity: 1, y: -20, scale: 1 }}
        exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
        className="bubble-container"
      >
        <div className="bubble-content">
          {isThinking ? (
             <div className="thinking-dots">
               <motion.div className="dot" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} />
               <motion.div className="dot" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} />
               <motion.div className="dot" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} />
             </div>
          ) : (
            message
          )}
          
          <div className="bubble-arrow"></div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ChatBubble;