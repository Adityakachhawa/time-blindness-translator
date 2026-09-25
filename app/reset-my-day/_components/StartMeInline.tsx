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
// Launch-intent URL builder
// ---------------------------------------------------------------------------

/**
 * Builds the RMD → TBT one-click exact-launch URL.
 *
 * URL contract (RMD-internal only):
 *   /time-translator
 *     ?task=<taskName>           — dedicated param; avoids overloading ?challenge=
 *                                   (challenge= is reserved for social challenge links)
 *     &min=<estimatedMinutes>    — exact allocation selected by RMD
 *     &source=reset-my-day       — identifies RMD as the origin; required for autostart
 *     &mode=exact                — requests Exact Time Mode (isExactTime=true, no ADHD tax)
 *     &autostart=1               — requests immediate START_MISSION
 *
 * SetupScreen reads ?task= in Branch A of the URL param useEffect.
 * The ?challenge= param triggers Branch B (social challenge banner) — entirely separate.
 * An RMD launch NEVER sets challengeData → the banner cannot appear.
 *
 * SetupScreen responds by:
 *   1. Dispatching UPDATE_SETUP with taskName=rmdTask, initialEstimate=min, isExactTime=true
 *   2. Setting pendingAutostart=true
 *   3. A useEffect fires START_MISSION once state.status==='setup' + taskName confirmed
 *
 * ── isMicroStep Note ─────────────────────────────────────────────────────────
 * The URL handoff does NOT support isMicroStep. The tiny step text is shown
 * for reading only. task.name (the real task) is what gets launched.
 * ─────────────────────────────────────────────────────────────────
 */
function buildLaunchUrl(task: SequencedTask): string {
  const params = new URLSearchParams({
    task: task.name,          // dedicated param — not ?challenge=
    min: String(task.estimatedMinutes),
    source: 'reset-my-day',
    mode: 'exact',
    autostart: '1',
  });
  return `/time-translator?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StartMeInline({ task }: StartMeInlineProps) {
  const [open, setOpen] = useState(false);
  const [activeMissionBlocked, setActiveMissionBlocked] = useState(false);

  const tinyStep = generateTinyStep(task.name);

  function handleStartExact() {
    // Active mission protection — never start a second mission.
    const active = getActiveMission();
    if (active && (active.status === 'running' || active.status === 'paused')) {
      setActiveMissionBlocked(true);
      return;
    }

    // Navigate to TBT with the RMD launch-intent URL.
    // SetupScreen will apply Exact Time Mode and auto-start the mission.
    window.location.href = buildLaunchUrl(task);
  }

  const durationLabel = task.estimatedMinutes === 1
    ? '1-min'
    : `${task.estimatedMinutes}-min`;

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
                  {/* Tiny step — shown for reading only, NOT launched as a mission */}
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
                  <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
                    Start the real task with the time we planned.
                  </p>

                  {/* One-click exact-launch button */}
                  <button
                    id={`start-exact-${task.id}`}
                    onClick={handleStartExact}
                    className="w-full px-4 py-2.5 rounded-lg text-xs font-bold outline-none transition-colors"
                    style={{
                      background: 'var(--color-coral-500)',
                      color: 'white',
                      minHeight: 44,
                    }}
                  >
                    Start {durationLabel} exact timer →
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
