'use client';

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { TimerAction, TimerState } from '../types/timer';
import { calculateActualTime, getRandomTagline, TAX_MULTIPLIER_DEFAULT } from '../lib/calculations';
import { incrementLifetimeStats, incrementDailyCount } from '../lib/storage';

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_ESTIMATE_DEFAULT = 15; // minutes

const initialActual = calculateActualTime(INITIAL_ESTIMATE_DEFAULT, TAX_MULTIPLIER_DEFAULT);

const initialState: TimerState = {
  status: 'setup',
  taskName: '',
  initialEstimate: INITIAL_ESTIMATE_DEFAULT,
  optimisticMin: INITIAL_ESTIMATE_DEFAULT,
  taxMultiplier: TAX_MULTIPLIER_DEFAULT,
  actualMinutes: initialActual,
  allocatedMin: initialActual,
  endTime: null,
  extensionCount: 0,
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function timerReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case 'UPDATE_SETUP': {
      // Only meaningful while in setup — ignore stray updates otherwise
      // (e.g. a stale input firing after the mission already started).
      if (state.status !== 'setup') return state;

      const nextTaskName = action.payload.taskName ?? state.taskName;
      const nextEstimate = action.payload.initialEstimate ?? state.initialEstimate;
      const nextTax = action.payload.taxMultiplier ?? state.taxMultiplier;
      const nextActual = calculateActualTime(nextEstimate, nextTax);

      return {
        ...state,
        taskName: nextTaskName,
        initialEstimate: nextEstimate,
        optimisticMin: nextEstimate,
        taxMultiplier: nextTax,
        actualMinutes: nextActual,
        allocatedMin: nextActual,
      };
    }

    case 'START_MISSION': {
      if (state.status !== 'setup') return state;

      return {
        ...state,
        status: 'active',
        endTime: Date.now() + state.actualMinutes * 60_000,
        extensionCount: 0,
      };
    }

    case 'COMPLETE_MISSION': {
      if (state.status !== 'active') return state;

      return {
        ...state,
        status: 'success',
        completedAt: Date.now(),
        tagline: getRandomTagline(),
      };
    }

    case 'EXPIRE_TIMER': {
      if (state.status !== 'active') return state;

      return {
        ...state,
        status: 'expired',
      };
    }

    case 'ADD_TEN_MINUTES': {
      if (state.status !== 'expired') return state;

      const bonusMinutes = 10;
      const nextActual = state.actualMinutes + bonusMinutes;

      return {
        ...state,
        status: 'active',
        // "No shame" — extend the total so the certificate/anchors still
        // reflect reality, and give a fresh 10-minute window from *now*
        // rather than re-adding to the old (already expired) endTime.
        actualMinutes: nextActual,
        allocatedMin: nextActual,
        endTime: Date.now() + bonusMinutes * 60_000,
        extensionCount: state.extensionCount + 1,
      };
    }

    case 'ADD_MINUTES': {
      if (state.status !== 'active' || !state.endTime) return state;

      const minutes = typeof action.payload === 'number' ? action.payload : action.payload.minutes;
      const nextActual = state.actualMinutes + minutes;

      return {
        ...state,
        actualMinutes: nextActual,
        allocatedMin: nextActual,
        endTime: state.endTime + minutes * 60_000,
        extensionCount: state.extensionCount + 1,
      };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context plumbing
// ---------------------------------------------------------------------------

interface TimerContextValue {
  state: TimerState;
  dispatch: Dispatch<TimerAction>;
}

const TimerContext = createContext<TimerContextValue | undefined>(undefined);

export function TimerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(timerReducer, initialState);

  // Self-correcting expiry watcher: scheduled off the absolute `endTime`
  // (not a decrementing counter), so backgrounding/foregrounding the tab
  // can't cause drift — on wake, we immediately re-check Date.now() against
  // endTime rather than trusting elapsed setInterval ticks.
  useEffect(() => {
    if (state.status !== 'active') return;

    // Captured as a plain number so the closure below doesn't rely on
    // TypeScript narrowing `state.endTime` across a nested function boundary.
    // Non-null assertion is safe: status === 'active' guarantees endTime is set.
    const endTime = state.endTime as number;
    const msRemaining = endTime - Date.now();

    if (msRemaining <= 0) {
      dispatch({ type: 'EXPIRE_TIMER' });
      return;
    }

    const timeoutId = window.setTimeout(() => {
      dispatch({ type: 'EXPIRE_TIMER' });
    }, msRemaining);

    // Reconcile immediately if the user returns to the tab after the
    // browser throttled background timers.
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && Date.now() >= endTime) {
        dispatch({ type: 'EXPIRE_TIMER' });
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.endTime]);

  // -------------------------------------------------------------------
  // Silent history & lifetime stats tracking — persist on completion
  // Uses `completedAt` as a unique key to prevent React Strict Mode
  // (or any re-render) from writing a duplicate entry or incrementing stats twice.
  // -------------------------------------------------------------------
  const lastRecordedCompletionRef = useRef<number | null>(null);

  useEffect(() => {
    if (state.status !== 'success' || !state.completedAt) return;
    if (lastRecordedCompletionRef.current === state.completedAt) return;
    lastRecordedCompletionRef.current = state.completedAt;

    const optimisticMin = state.optimisticMin ?? state.initialEstimate;
    const allocatedMin  = state.allocatedMin  ?? state.actualMinutes;
    const minutesSaved  = allocatedMin - optimisticMin;

    incrementLifetimeStats(minutesSaved, state.extensionCount);
    incrementDailyCount(new Date(state.completedAt));

    // Fire-and-forget mission counter increment
    try {
      fetch('/api/mission-count', { method: 'POST' }).catch(() => {});
    } catch {
      // Silently fail
    }

    const KEY = 'tbt_history';

    try {
      const raw = typeof window !== 'undefined'
        ? window.localStorage.getItem(KEY)
        : null;
      const history: Record<string, unknown>[] = raw ? JSON.parse(raw) : [];

      // Dedup: skip if a record with this completedAt already exists
      if (history.some((r) => r.id === state.completedAt || r.completedAt === state.completedAt)) {
        return;
      }

      history.unshift({
        id:            state.completedAt,
        taskName:      state.taskName,
        optimisticMin,
        taxMultiplier: state.taxMultiplier,
        allocatedMin,
        actualMinutes: allocatedMin,
        completedAt:   state.completedAt,
        tagline:       state.tagline ?? null,
      });

      // Cap at 50 entries
      window.localStorage.setItem(KEY, JSON.stringify(history.slice(0, 50)));
    } catch {
      // localStorage unavailable — silently ignore
    }
  }, [
    state.status,
    state.completedAt,
    state.taskName,
    state.initialEstimate,
    state.optimisticMin,
    state.taxMultiplier,
    state.actualMinutes,
    state.allocatedMin,
    state.tagline,
    state.extensionCount,
  ]);

  return (
    <TimerContext.Provider value={{ state, dispatch }}>
      {children}
    </TimerContext.Provider>
  );
}

/** Access the timer state machine from any descendant of <TimerProvider>. */
export function useTimer(): TimerContextValue {
  const context = useContext(TimerContext);
  if (context === undefined) {
    throw new Error('useTimer must be used within a <TimerProvider>');
  }
  return context;
}
