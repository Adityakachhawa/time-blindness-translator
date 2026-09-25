'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { buildRecoveryPlan } from './lib/sequencer';
import type { RmdTask, RecoveryPlan } from './lib/sequencer';
import TimeBudgetStep, { type TimeBudget } from './_components/TimeBudgetStep';
import TaskCaptureStep from './_components/TaskCaptureStep';
import RecoveryPlanView from './_components/RecoveryPlanView';
import { getRmdSession, saveRmdSession, clearRmdSession } from './lib/session';
import { getTaskHistory } from '@/lib/storage';

// ---------------------------------------------------------------------------
// Flow steps
// ---------------------------------------------------------------------------

type Step = 'budget' | 'tasks' | 'plan';

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ResetMyDayPage() {
  const [step, setStep] = useState<Step>('budget');
  const [budget, setBudget] = useState<TimeBudget | null>(null);
  const [plan, setPlan] = useState<RecoveryPlan | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Initialize and reconcile session on mount
  useState(() => {
    if (typeof window !== 'undefined') {
      const session = getRmdSession();
      if (session) {
        const history = getTaskHistory();
        
        const reconcileBucket = (tasks: typeof session.plan.doNow) => {
          return tasks.map(task => {
            if (task.startedAt && !task.completedAt) {
              const match = history.find(
                h => h.completedAt > task.startedAt! && h.taskName.toLowerCase() === task.name.toLowerCase()
              );
              if (match) {
                return { ...task, completedAt: match.completedAt };
              }
            }
            return task;
          });
        };

        const reconciledPlan = {
          ...session.plan,
          doNow: reconcileBucket(session.plan.doNow),
          then: reconcileBucket(session.plan.then),
          optional: reconcileBucket(session.plan.optional),
          skip: reconcileBucket(session.plan.skip),
        };

        // Update session if reconciliation changed anything
        saveRmdSession({ ...session, plan: reconciledPlan });
        
        setBudget({ minutes: reconciledPlan.budgetMinutes });
        setPlan(reconciledPlan);
        setStep('plan');
      }
      setIsInitializing(false);
    }
  });

  function handleBudgetConfirm(b: TimeBudget) {
    setBudget(b);
    setStep('tasks');
  }

  function handleTasksConfirm(tasks: RmdTask[]) {
    if (!budget) return;
    const recoveryPlan = buildRecoveryPlan(tasks, budget.minutes);
    setPlan(recoveryPlan);
    saveRmdSession({ plan: recoveryPlan, createdAt: Date.now() });
    setStep('plan');
  }

  function handleReset() {
    setBudget(null);
    setPlan(null);
    clearRmdSession();
    setStep('budget');
  }

  // Progress indicator (steps 1-2, hidden on plan view)
  const showProgress = step !== 'plan';
  const stepNumber = step === 'budget' ? 1 : 2;

  if (isInitializing) return null; // Wait for hydration and session logic

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 pb-20">
      {/* Page heading */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-10 text-center"
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--color-coral-500)' + '18' }}
          >
            <RotateCcw
              className="w-5 h-5"
              style={{ color: 'var(--color-coral-500)' }}
            />
          </div>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-black uppercase tracking-widest"
            style={{
              background: 'var(--color-coral-500)' + '18',
              color: 'var(--color-coral-500)',
            }}
          >
            Beta
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: 'var(--fg)' }}>
          Reset My Day
        </h1>
        <p
          className="text-base font-medium max-w-sm mx-auto"
          style={{ color: 'var(--muted)' }}
        >
          Things got off track. Let's figure out what still matters.
        </p>
      </motion.div>

      {/* Progress dots */}
      {showProgress && (
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="rounded-full transition-all"
              style={{
                width: n === stepNumber ? 24 : 8,
                height: 8,
                background:
                  n === stepNumber
                    ? 'var(--color-coral-500)'
                    : 'var(--card-border)',
              }}
            />
          ))}
        </div>
      )}

      {/* Steps */}
      <AnimatePresence mode="wait">
        {step === 'budget' && (
          <motion.div
            key="budget"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.28 }}
          >
            <TimeBudgetStep onConfirm={handleBudgetConfirm} />
          </motion.div>
        )}

        {step === 'tasks' && budget && (
          <motion.div
            key="tasks"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.28 }}
          >
            <TaskCaptureStep
              budgetMinutes={budget.minutes}
              onConfirm={handleTasksConfirm}
              onBack={() => setStep('budget')}
            />
          </motion.div>
        )}

        {step === 'plan' && plan && (
          <motion.div
            key="plan"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.28 }}
          >
            <RecoveryPlanView plan={plan} onReset={handleReset} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
