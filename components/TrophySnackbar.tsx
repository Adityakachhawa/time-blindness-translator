'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Award, Flame, Rocket, Star, Medal, Crown, Zap } from 'lucide-react';
import { TROPHIES } from '@/lib/trophies';
import { useEffect, useState } from 'react';

const ICONS: Record<string, any> = {
  Award, Flame, Rocket, Star, Medal, Crown, Zap
};

export default function TrophySnackbar({ trophyId }: { trophyId: string | null }) {
  const [show, setShow] = useState(false);
  
  useEffect(() => {
    if (trophyId) {
      setShow(true);
      const t = setTimeout(() => setShow(false), 5000); // Hide after 5s
      return () => clearTimeout(t);
    }
  }, [trophyId]);

  const trophy = TROPHIES.find(t => t.id === trophyId);
  const Icon = trophy ? (ICONS[trophy.lucideIcon] || Award) : Award;

  return (
    <AnimatePresence>
      {show && trophy && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-6 left-0 right-0 mx-auto w-max z-50 px-4 py-3 rounded-full flex items-center gap-3 shadow-2xl"
          style={{
            background: 'rgba(30, 41, 59, 0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, #f5a623 0%, #f2815a 100%)',
              color: 'white',
              boxShadow: '0 2px 8px rgba(245,166,35,0.4)',
            }}
          >
            <Icon className="w-4 h-4" strokeWidth={2.5} />
          </div>
          <div className="pr-2 text-left">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 leading-none mb-1">
              New Trophy Unlocked!
            </p>
            <p className="text-sm font-semibold text-white leading-none">
              {trophy.label}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
