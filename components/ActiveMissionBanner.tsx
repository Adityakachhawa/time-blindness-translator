'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTimer } from '@/context/TimerContext';
import { Play } from 'lucide-react';

export default function ActiveMissionBanner() {
  const { state, dispatch } = useTimer();
  const [msLeft, setMsLeft] = useState(0);

  // We only show this if there's an active mission but we are NOT on the active screen
  const shouldShow = state.activeMission && (state.status === 'setup' || state.status === 'success');

  useEffect(() => {
    if (!shouldShow || !state.activeMission) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, state.activeMission!.expectedEndAt - Date.now());
      setMsLeft(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [shouldShow, state.activeMission]);

  if (!shouldShow) return null;

  const totalSec = Math.max(0, Math.ceil(msLeft / 1000));
  const min = Math.floor(totalSec / 60);
  const timeLabel = `${min} min remaining`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        className="fixed top-0 inset-x-0 z-50 flex justify-center p-2 pointer-events-none"
      >
        <div 
          className="pointer-events-auto cursor-pointer shadow-lg rounded-full flex items-center gap-3 px-4 py-2 w-full max-w-sm border backdrop-blur-md"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--color-amber-400)',
          }}
          onClick={() => dispatch({ type: 'RESUME_MISSION' })} // Assume RESUME_MISSION or a new action restores the view
        >
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: 'var(--fg)' }}>
              {state.activeMission.taskName}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {timeLabel}
            </p>
          </div>
          <div className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
            <Play className="w-3 h-3" /> Resume
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
