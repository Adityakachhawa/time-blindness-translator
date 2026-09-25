'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Lightbulb, Clock } from 'lucide-react';
import { generateTinyStep } from '@/lib/startMe';
import { getActiveMission } from '@/lib/mission/storage';
import type { SequencedTask } from '../lib/sequencer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StartMeInlineProps {
  task: SequencedTask;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * "Stuck? Start Me" inline panel for DO_NOW / THEN tasks.
 *
 * Reuses generateTinyStep() from lib/startMe.ts without modification.
 *
 * ── isMicroStep Architecture Note ──────────────────────────────────────────
 *
 * TBT's `isMicroStep` flag prevents micro-step records from contaminating
 * calibration (calculatePersonalFactor, getTaskHistoricalRange both filter
 * out records where isMicroStep === true).
 *
 * The existing TBT URL handoff (?challenge=&min=) does NOT support
 * isMicroStep as a URL parameter. The UPDATE_SETUP dispatch in SetupScreen
 * (line 251) only accepts: taskName, category, initialEstimate, personalFactor,
 * isManualOverride — NOT isMicroStep.
 *
 * isMicroStep is only set programmatically from within TBT's own
 * "Start tiny step" button (SetupScreen.tsx line 691), never from a URL param.
 *
 * Because TBT is frozen, we cannot add isMicroStep URL support.
 * Therefore, this component does NOT launch micro-steps as TBT missions.
 *
 * What RMD does instead:
 *   - Reveals the tiny step text (useful for the user to read and act on)
 *   - Offers "Start full task" → navigates to TBT pre-filled with the real
 *     task name and full estimate (NOT the tiny step text). This is a normal
 *     mission — calibration-safe.
 *   - Does NOT offer a "Start this micro-step" button that would create an
 *     uncalibrated record in history.
 *
 * ────────────────────────────────────────────────────────────────────────────
 */
export default function StartMeInline({ task }: StartMeInlineProps) {
  const [open, setOpen] = useState(false);
  const [activeMissionBlocked, setActiveMissionBlocked] = useState(false);

  // generateTinyStep is called unchanged — not modified.
  const tinyStep = generateTinyStep(task.name);

  function handleStartFullMission() {
    // Active mission protection — never start a second mission.
    const active = getActiveMission();
    if (active && (active.status === 'running' || active.status === 'paused')) {
      setActiveMissionBlocked(true);
      return;
    }

    // Handoff: navigate to /time-translator pre-filled with the REAL task
    // name and the REAL estimate — not the tiny step text.
    // This is a normal mission; isMicroStep defaults to false in TBT.
    // Calibration is not contaminated because the real task name and real
    // duration are recorded, exactly as if the user had started from TBT directly.
    const params = new URLSearchParams({
      challenge: task.name,
      min: String(task.estimatedMinutes),
    });
    window.location.href = `/time-translator?${params.toString()}`;
  }

  return (
    <div className="mt-3">
      {/* Trigger */}
      <button
        id={`start-me-${task.id}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 text-xs font-bold outline-none transition-all rounded-lg px-2 py-1"
        style={{ color: 'var(--color-amber-600)', minHeight: 36 }}
      >
        <Lightbulb className="w-3.5 h-3.5" />
        Stuck? Start Me
        {open ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div
              className="mt-2 rounded-xl p-4"
              style={{
                background: 'var(--color-amber-500)' + '12',
                border: '1.5px solid var(--color-amber-500)',
              }}
            >
              {/* Active mission conflict */}
              {activeMissionBlocked ? (
                <div className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
                  <p className="mb-3">You already have a mission in progress.</p>
                  <a
                    href="/time-translator"
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg outline-none"
                    style={{
                      background: 'var(--color-coral-500)',
                      color: 'white',
                    }}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Back to active mission
                  </a>
                </div>
              ) : (
                <>
                  {/* Tiny step — displayed for reading, not launched as a mission */}
                  <p
                    className="text-sm font-semibold mb-1 leading-relaxed"
                    style={{ color: 'var(--fg)' }}
                  >
                    <span
                      className="block text-xs font-bold uppercase tracking-wider mb-1"
                      style={{ color: 'var(--muted)' }}
                    >
                      Start here
                    </span>
                    {tinyStep}
                  </p>
                  <p
                    className="text-xs mb-4"
                    style={{ color: 'var(--muted)' }}
                  >
                    Do this one thing. Then open the timer if you want to keep going.
                  </p>

                  {/* Single action: start the real full task in TBT */}
                  <button
                    id={`start-full-${task.id}`}
                    onClick={handleStartFullMission}
                    className="w-full px-4 py-2.5 rounded-lg text-xs font-bold outline-none transition-colors"
                    style={{
                      background: 'var(--color-coral-500)',
                      color: 'white',
                      minHeight: 44,
                    }}
                  >
                    Ready — start the timer for "{task.name}" →
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
