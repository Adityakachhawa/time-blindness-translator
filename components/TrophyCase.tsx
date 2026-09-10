'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Award, Flame, Rocket, Star, Medal, Crown, Zap } from 'lucide-react';
import { TROPHIES } from '@/lib/trophies';
import { getUnlockedTrophies } from '@/lib/storage';

const ICONS: Record<string, any> = {
  Award, Flame, Rocket, Star, Medal, Crown, Zap
};

export default function TrophyCase() {
  const [unlockedIds, setUnlockedIds] = useState<Record<string, number>>({});

  // Hydrate on mount to ensure SSR safety
  useEffect(() => {
    const unlocked = getUnlockedTrophies();
    const map: Record<string, number> = {};
    unlocked.forEach(t => { map[t.id] = t.earnedAt; });
    setUnlockedIds(map);
  }, []);

  return (
    <div className="flex flex-col gap-3 py-3 px-5">
      <p
        className="text-xs uppercase tracking-widest font-semibold mb-2"
        style={{ color: '#94a3b8' }}
      >
        Your Milestones
      </p>
      
      <div className="grid grid-cols-2 gap-3">
        {TROPHIES.map((t) => {
          const earnedAt = unlockedIds[t.id];
          const isUnlocked = earnedAt !== undefined;
          const Icon = ICONS[t.lucideIcon] || Award;
          
          return (
            <motion.div
              key={t.id}
              whileHover={isUnlocked ? { scale: 1.02, y: -2 } : {}}
              className="relative flex flex-col p-4 rounded-2xl overflow-hidden"
              style={{
                background: isUnlocked 
                  ? 'linear-gradient(135deg, rgba(245,166,35,0.1), rgba(242,129,90,0.1))' 
                  : 'rgba(0,0,0,0.02)',
                border: isUnlocked 
                  ? '1.5px solid rgba(245,166,35,0.3)' 
                  : '1.5px solid rgba(0,0,0,0.05)',
                filter: isUnlocked ? 'none' : 'grayscale(100%) opacity(0.6)',
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: isUnlocked ? 'var(--color-amber-400)' : '#cbd5e1',
                    color: isUnlocked ? 'white' : '#94a3b8',
                    boxShadow: isUnlocked ? '0 4px 12px rgba(245,166,35,0.4)' : 'none',
                  }}
                >
                  <Icon className="w-5 h-5" strokeWidth={2.5} />
                </div>
                {!isUnlocked && <Lock className="w-4 h-4 text-slate-400" />}
              </div>
              
              <h4 className="font-bold text-sm mb-1" style={{ color: isUnlocked ? 'var(--fg)' : '#64748b' }}>
                {t.label}
              </h4>
              
              {isUnlocked ? (
                <p className="text-xs font-medium leading-snug" style={{ color: 'var(--color-coral-600)' }}>
                  Earned {new Date(earnedAt).toLocaleDateString()}
                </p>
              ) : (
                <p className="text-xs leading-snug" style={{ color: '#94a3b8' }}>
                  {t.type === 'streak' ? `Reach a ${t.threshold}-day streak` : `Complete ${t.threshold} missions`}
                </p>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
