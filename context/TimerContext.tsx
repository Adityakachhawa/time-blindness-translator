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
import { calculateActualTime, TAX_MULTIPLIER_DEFAULT } from '../lib/calculations';
import { getActiveMission } from '../lib/mission/storage';
import {
  startMission,
  pauseMission,
  resumeMission,
  completeMission,
  extendMission,
  reconcileMission,
} from '../lib/mission/actions';

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_ESTIMATE_DEFAULT = 15; // minutes

const initialActual = calculateActualTime(INITIAL_ESTIMATE_DEFAULT, TAX_MULTIPLIER_DEFAULT);

const initialState: TimerState = {
  status: 'setup',
  taskName: '',
  initialEstimate: INITIAL_ESTIMATE_DEFAULT,
  predictedSeconds: INITIAL_ESTIMATE_DEFAULT * 60,
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
    case 'RECOVER_MISSION': {
      const activeMission = action.payload;
      if (!activeMission) return state;
      
      let newStatus = state.status;
      if (activeMission.status === 'running') newStatus = 'active';
      else if (activeMission.status === 'paused') newStatus = 'active';
      else if (activeMission.status === 'completed') newStatus = 'success';

      // Check if it's expired/overtime
      if (newStatus === 'active' && activeMission.status === 'running') {
        if (Date.now() >= activeMission.expectedEndAt) {
          newStatus = 'expired';
        }
      }

      return {
        ...state,
        status: newStatus as any,
        taskName: activeMission.taskName,
        category: activeMission.category,
        initialEstimate: activeMission.optimisticMin, // mapping best effort
        optimisticMin: activeMission.optimisticMin,
        taxMultiplier: activeMission.taxMultiplier,
        actualMinutes: activeMission.allocatedMin,
        allocatedMin: activeMission.allocatedMin,
        endTime: activeMission.expectedEndAt,
        activeMission,
      };
    }

    case 'UPDATE_SETUP': {
      if (state.status !== 'setup') return state;

      const nextTaskName = action.payload.taskName ?? state.taskName;
      const nextCategory = action.payload.category ?? state.category;
      const nextEstimate = action.payload.initialEstimate ?? state.initialEstimate;
      const nextTax = action.payload.taxMultiplier ?? state.taxMultiplier;
      const nextPersonalFactor = action.payload.personalFactor !== undefined ? action.payload.personalFactor : state.personalFactor;
      const nextOverride = action.payload.isManualOverride !== undefined ? action.payload.isManualOverride : state.isManualOverride;
      const nextTransition = action.payload.transitionMinutes !== undefined ? action.payload.transitionMinutes : (state.transitionMinutes || 0);

      const effectiveMultiplier = (!nextOverride && nextPersonalFactor) ? nextPersonalFactor : nextTax;
      const nextActual = calculateActualTime(nextEstimate, effectiveMultiplier) + nextTransition;

      return {
        ...state,
        taskName: nextTaskName,
        category: nextCategory,
        initialEstimate: nextEstimate,
        predictedSeconds: nextEstimate * 60,
        optimisticMin: nextEstimate,
        taxMultiplier: nextTax,
        personalFactor: nextPersonalFactor,
        isManualOverride: nextOverride,
        transitionMinutes: nextTransition,
        actualMinutes: nextActual,
        allocatedMin: nextActual,
      };
    }

    case 'START_MISSION': {
      if (state.status !== 'setup') return state;

      const plannedDurationMs = state.actualMinutes * 60_000;
      
      const newMission = startMission(
        state.taskName,
        plannedDurationMs,
        state.initialEstimate,
        state.taxMultiplier,
        state.actualMinutes,
        state.transitionMinutes,
        state.category
      );

      return {
        ...state,
        status: 'active',
        endTime: newMission.expectedEndAt,
        startTime: newMission.startedAt,
        extensionCount: 0,
        isOvertimeAcknowledged: false,
        activeMission: newMission,
      };
    }

    case 'PAUSE_MISSION': {
      if (state.status !== 'active' || !state.activeMission) return state;
      const pausedMission = pauseMission(state.activeMission);
      return {
        ...state,
        activeMission: pausedMission
      };
    }

    case 'RESUME_MISSION': {
      if (state.status !== 'active' || !state.activeMission) return state;
      const resumedMission = resumeMission(state.activeMission);
      return {
        ...state,
        activeMission: resumedMission,
        endTime: resumedMission.expectedEndAt
      };
    }

    case 'COMPLETE_MISSION': {
      if (!state.activeMission) return state;
      
      completeMission(state.activeMission, state.tagline);
      
      return {
        ...state,
        status: 'success',
        completedAt: Date.now(),
        activeMission: null, // Clear from React state
      };
    }

    case 'EXPIRE_TIMER': {
      if (state.status !== 'active') return state;
      return {
        ...state,
        status: 'expired',
      };
    }

    case 'ACKNOWLEDGE_OVERTIME': {
      return {
        ...state,
        status: 'active',
        isOvertimeAcknowledged: true,
      };
    }

    case 'ADD_TEN_MINUTES': {
      if (!state.activeMission) return state;
      
      const updatedMission = extendMission(state.activeMission, 10);
      
      return {
        ...state,
        status: 'active',
        activeMission: updatedMission,
        actualMinutes: updatedMission.allocatedMin,
        allocatedMin: updatedMission.allocatedMin,
        endTime: updatedMission.expectedEndAt,
        extensionCount: state.extensionCount + 1,
        isOvertimeAcknowledged: false,
      };
    }

    case 'ADD_MINUTES': {
      if (state.status !== 'active' || !state.endTime || !state.activeMission) return state;

      const minutes = typeof action.payload === 'number' ? action.payload : action.payload.minutes;
      const updatedMission = extendMission(state.activeMission, minutes);

      return {
        ...state,
        actualMinutes: updatedMission.allocatedMin,
        allocatedMin: updatedMission.allocatedMin,
        endTime: updatedMission.expectedEndAt,
        extensionCount: state.extensionCount + 1,
        activeMission: updatedMission,
      };
    }

    case 'ANNOUNCE_MISSION': {
      if (state.status !== 'active') return state;
      return {
        ...state,
        wasAnnounced: true,
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

  // SSR-safe startup and lifecycle reconciliation
  useEffect(() => {
    if (typeof window === 'undefined') return;

    function handleReconcile() {
      const recovered = reconcileMission();
      if (recovered) {
        dispatch({ type: 'RECOVER_MISSION', payload: recovered });
      }
    }

    // Initial startup
    handleReconcile();

    // Browser lifecycle events
    window.addEventListener('focus', handleReconcile);
    window.addEventListener('pageshow', handleReconcile);
    
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        handleReconcile();
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleReconcile);
      window.removeEventListener('pageshow', handleReconcile);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Self-correcting expiry watcher
  useEffect(() => {
    if (state.status !== 'active' || !state.endTime) return;
    
    // If it's paused, we don't automatically expire it
    if (state.activeMission && state.activeMission.status === 'paused') return;

    const msRemaining = state.endTime - Date.now();

    if (msRemaining <= 0) {
      dispatch({ type: 'EXPIRE_TIMER' });
      return;
    }

    const timeoutId = window.setTimeout(() => {
      dispatch({ type: 'EXPIRE_TIMER' });
    }, msRemaining);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [state.status, state.endTime, state.activeMission?.status]);

  return (
    <TimerContext.Provider value={{ state, dispatch }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer(): TimerContextValue {
  const context = useContext(TimerContext);
  if (context === undefined) {
    throw new Error('useTimer must be used within a <TimerProvider>');
  }
  return context;
}
