import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MissionCompleteProps {
  onClose: () => void;
  badgeUnlocked?: string;
  gadgetUnlocked?: string;
}

export default function MissionComplete({ onClose, badgeUnlocked, gadgetUnlocked }: MissionCompleteProps) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 800);
    const t2 = setTimeout(() => setStage(2), 2000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-primary/90 p-6 text-center"
      >
        {stage >= 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="text-6xl mb-4"
          >
            🏆
          </motion.div>
        )}

        {stage >= 1 && (
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="font-display text-3xl font-black text-white mb-2"
          >
            Mission Accomplished!
          </motion.h2>
        )}

        {stage >= 2 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="space-y-3"
          >
            {badgeUnlocked && (
              <div className="rounded-xl bg-accent/20 px-4 py-2 text-accent font-bold">
                Badge Unlocked: {badgeUnlocked}
              </div>
            )}
            {gadgetUnlocked && (
              <div className="rounded-xl bg-green/20 px-4 py-2 text-green font-bold">
                Gadget Unlocked: {gadgetUnlocked}
              </div>
            )}
            <button
              onClick={onClose}
              className="mt-6 rounded-xl bg-accent px-8 py-3 font-bold text-white shadow-lg"
            >
              Back to Dashboard
            </button>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
