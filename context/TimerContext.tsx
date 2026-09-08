'use client';

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { TimerAction, TimerState } from '../types/timer';
import { calculateActualTime, getRandomTagline, TAX_MULTIPLIER_DEFAULT } from '../lib/calculations';

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_ESTIMATE_DEFAULT = 15; // minutes

const initialState: TimerState = {
  status: 'setup',
  taskName: '',
  initialEstimate: INITIAL_ESTIMATE_DEFAULT,
  taxMultiplier: TAX_MULTIPLIER_DEFAULT,
  actualMinutes: calculateActualTime(INITIAL_ESTIMATE_DEFAULT, TAX_MULTIPLIER_DEFAULT),
  endTime: null,
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

      return {
        ...state,
        taskName: nextTaskName,
        initialEstimate: nextEstimate,
        taxMultiplier: nextTax,
        actualMinutes: calculateActualTime(nextEstimate, nextTax),
      };
    }

    case 'START_MISSION': {
      if (state.status !== 'setup') return state;

      return {
        ...state,
        status: 'active',
        endTime: Date.now() + state.actualMinutes * 60_000,
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

      return {
        ...state,
        status: 'active',
        // "No shame" — extend the total so the certificate/anchors still
        // reflect reality, and give a fresh 10-minute window from *now*
        // rather than re-adding to the old (already expired) endTime.
        actualMinutes: state.actualMinutes + bonusMinutes,
        endTime: Date.now() + bonusMinutes * 60_000,
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
  // Silent history tracking — persist enriched record on completion
  // Uses `completedAt` as a unique key to prevent React Strict Mode
  // (or any re-render) from writing a duplicate entry.
  // -------------------------------------------------------------------
  useEffect(() => {
    if (state.status !== 'success' || !state.completedAt) return;

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
        optimisticMin: state.initialEstimate,
        taxMultiplier: state.taxMultiplier,
        allocatedMin:  state.actualMinutes,
        actualMinutes: state.actualMinutes,
        completedAt:   state.completedAt,
        tagline:       state.tagline ?? null,
      });

      // Cap at 50 entries
      window.localStorage.setItem(KEY, JSON.stringify(history.slice(0, 50)));
    } catch {
      // localStorage unavailable — silently ignore
    }
  }, [state.status, state.completedAt, state.taskName, state.initialEstimate, state.taxMultiplier, state.actualMinutes, state.tagline]);

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
