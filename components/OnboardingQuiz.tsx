'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, BatteryWarning, Zap, Target, Coffee, VolumeX, Waves } from 'lucide-react';
import type { Track } from '@/hooks/useAmbientAudio';

export interface QuizResult {
  taskName: string;
  initialEstimate: number;
  track: Track;
  muted: boolean;
}

interface OnboardingQuizProps {
  onComplete: (result: QuizResult) => void;
  onSkip: () => void;
}

type Question = {
  title: string;
  options: {
    label: string;
    sub?: string;
    icon?: React.ReactNode;
    value: any;
  }[];
};

const QUESTIONS: Question[] = [
  {
    title: "What's the main boss right now?",
    options: [
      { label: 'Task Paralysis', sub: "I don't know where to start", value: 'Just start' },
      { label: 'Time Blindness', sub: 'I have no idea how long things take', value: 'Time Estimation' },
      { label: 'Distraction City', sub: 'My brain keeps wandering', value: 'Focus Sprint' },
    ],
  },
  {
    title: "What's the brain battery at?",
    options: [
      { label: 'Running on fumes', sub: 'Low energy', icon: <BatteryWarning className="w-5 h-5 text-red-400" />, value: 5 },
      { label: 'Squirrel energy', sub: 'Restless / distracted', icon: <Zap className="w-5 h-5 text-amber-400" />, value: 15 },
      { label: 'Weirdly hyperfocused', sub: 'Ready to lock in', icon: <Target className="w-5 h-5 text-coral-500" />, value: 25 },
    ],
  },
  {
    title: "What kind of vibe do we need?",
    options: [
      { label: 'Total silence', icon: <VolumeX className="w-5 h-5 text-slate-400" />, value: { track: 'off', muted: true } },
      { label: 'Coffee shop chatter', icon: <Coffee className="w-5 h-5 text-amber-600" />, value: { track: 'cafe', muted: false } },
      { label: 'Brown noise', icon: <Waves className="w-5 h-5 text-teal-500" />, value: { track: 'brown-noise', muted: false } },
    ],
  },
];

export default function OnboardingQuiz({ onComplete, onSkip }: OnboardingQuizProps) {
  const prefersReducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<any[]>([]);

  const handleSelect = (val: any) => {
    const newAnswers = [...answers, val];
    if (step < QUESTIONS.length - 1) {
      setAnswers(newAnswers);
      setStep(s => s + 1);
    } else {
      // Done!
      onComplete({
        taskName: newAnswers[0],
        initialEstimate: newAnswers[1],
        track: val.track,
        muted: val.muted,
      });
    }
  };

  const variants = prefersReducedMotion ? {
    enter: { opacity: 0 },
    center: { opacity: 1 },
    exit: { opacity: 0 }
  } : {
    enter: { x: 50, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -50, opacity: 0 }
  };

  const q = QUESTIONS[step];

  return (
    <div className="w-full relative flex flex-col justify-center min-h-[420px]">
      <button 
        onClick={onSkip}
        className="absolute -top-2 right-0 p-2 text-slate-400 hover:text-slate-600 transition-colors z-20"
        aria-label="Skip quiz"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Progress dots */}
      <div className="absolute top-0 left-0 right-0 flex justify-center gap-2 z-10">
        {QUESTIONS.map((_, i) => (
          <div 
            key={i} 
            className="w-2 h-2 rounded-full transition-colors"
            style={{ background: i === step ? 'var(--color-coral-500)' : 'rgba(0,0,0,0.1)' }}
          />
        ))}
      </div>

      <div className="relative w-full mt-10 flex-1 overflow-visible">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-full flex flex-col gap-6"
          >
            <h2 className="text-2xl font-black text-center leading-tight" style={{ color: 'var(--fg)' }}>
              {q.title}
            </h2>

            <div className="flex flex-col gap-3 pb-2">
              {q.options.map((opt, i) => (
                <motion.button
                  key={i}
                  whileHover={!prefersReducedMotion ? { y: -2, scale: 1.02 } : {}}
                  whileTap={!prefersReducedMotion ? { scale: 0.98 } : {}}
                  onClick={() => handleSelect(opt.value)}
                  className="flex items-center gap-4 text-left w-full p-4 rounded-2xl transition-shadow hover:shadow-md"
                  style={{
                    background: 'var(--card)',
                    border: '1.5px solid var(--card-border)',
                  }}
                >
                  {opt.icon && (
                    <div className="shrink-0 bg-slate-50 dark:bg-slate-800 p-2 rounded-full">
                      {opt.icon}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-lg leading-tight" style={{ color: 'var(--fg)' }}>
                      {opt.label}
                    </p>
                    {opt.sub && (
                      <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
                        {opt.sub}
                      </p>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
