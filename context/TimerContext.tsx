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
  recalculateMission,
  reconcileMission,
} from '../lib/mission/actions';
import { getMissionAwarenessEvents } from '../lib/mission/awareness';
import { sendAwarenessNotification } from '../lib/notifications/notificationManager';
import { setAppBadge } from '../lib/notifications/badgeManager';
import { trackEvent, getRetentionMetrics, getAccuracyImprovement } from '../lib/analytics/localAnalytics';

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
  isExactTime: false,
  isMicroStep: false,
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

      // Removed: We no longer transition to 'expired' automatically.
      // Overtime is handled seamlessly while status remains 'active'.

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
        // Restore immutable calibration baseline from the persisted mission.
        initialCalibratedMin: activeMission.initialCalibratedMs
          ? activeMission.initialCalibratedMs / 60_000
          : activeMission.allocatedMin,
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
      const nextExact = action.payload.isExactTime !== undefined ? action.payload.isExactTime : (state.isExactTime ?? false);
      const nextMicroStep = action.payload.isMicroStep !== undefined ? action.payload.isMicroStep : (state.isMicroStep ?? false);

      // In exact-time mode: force multiplier = 1.0, no transition time, no rounding
      const effectiveMultiplier = nextExact ? 1.0 : ((!nextOverride && nextPersonalFactor) ? nextPersonalFactor : nextTax);
      const effectiveTransition = nextExact ? 0 : nextTransition;
      const nextActual = calculateActualTime(nextEstimate, effectiveMultiplier, nextExact) + effectiveTransition;

      return {
        ...state,
        taskName: nextTaskName,
        category: nextCategory,
        initialEstimate: nextEstimate,
        predictedSeconds: nextEstimate * 60,
        optimisticMin: nextEstimate,
        taxMultiplier: nextExact ? 1.0 : nextTax,
        personalFactor: nextPersonalFactor,
        isManualOverride: nextOverride,
        transitionMinutes: effectiveTransition,
        isExactTime: nextExact,
        isMicroStep: nextMicroStep,
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
        state.category,
        state.isMicroStep
      );

      return {
        ...state,
        status: 'active',
        endTime: newMission.expectedEndAt,
        startTime: newMission.startedAt,
        extensionCount: 0,
        isOvertimeAcknowledged: false,
        // Snapshot the initial calibrated budget once — never overwritten.
        initialCalibratedMin: state.actualMinutes,
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
      if (state.activeMission) {
        // If we were minimized (status === 'setup'), just resume the view and active state
        if (state.status === 'setup' || state.status === 'success') {
          return {
            ...state,
            status: 'active',
            endTime: state.activeMission.expectedEndAt
          };
        }
        // Otherwise handle actual mission un-pausing
        if (state.status === 'active') {
          const resumedMission = resumeMission(state.activeMission);
          return {
            ...state,
            activeMission: resumedMission,
            endTime: resumedMission.expectedEndAt
          };
        }
      }
      return state;
    }

    case 'MINIMIZE_MISSION': {
      if (!state.activeMission) return state;
      return {
        ...state,
        status: 'setup' // returning to setup view reveals the banner
      };
    }

    case 'COMPLETE_MISSION': {
      if (!state.activeMission) return state;

      const { completedRecordId, actualSeconds } = completeMission(
        state.activeMission,
        state.tagline,
      );

      return {
        ...state,
        status: 'success',
        completedAt: Date.now(),
        completedRecordId,
        // Real elapsed seconds — used by SuccessScreen for the accuracy calc.
        actualSeconds,
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

    case 'RECALCULATE_MISSION': {
      if (!state.activeMission) return state;
      
      const updatedMission = recalculateMission(state.activeMission, action.payload.remainingMinutes);
      
      return {
        ...state,
        status: 'active',
        activeMission: updatedMission,
        actualMinutes: updatedMission.allocatedMin,
        allocatedMin: updatedMission.allocatedMin,
        endTime: updatedMission.expectedEndAt,
        extensionCount: state.extensionCount + 1,
      };
    }

    case 'ANNOUNCE_MISSION': {
      if (state.status !== 'active') return state;
      return {
        ...state,
        wasAnnounced: true,
      };
    }

    case 'SET_NOTIFICATION_MESSAGE_ID': {
      if (!state.activeMission) return state;
      return {
        ...state,
        activeMission: { ...state.activeMission, notificationMessageId: action.payload }
      };
    }

    case 'CHAIN_MISSION': {
      // Preserve session context (day-level prefs), clear task-specific state.
      // Optionally pre-fills a chosen next task name.
      const nextTaskName = action.payload?.taskName ?? '';
      const nextActual = calculateActualTime(
        INITIAL_ESTIMATE_DEFAULT,
        state.isExactTime ? 1.0 : state.taxMultiplier,
        state.isExactTime ?? false,
      );
      return {
        ...state,
        status: 'setup',
        // Clear task-specific
        taskName: nextTaskName,
        initialEstimate: INITIAL_ESTIMATE_DEFAULT,
        predictedSeconds: INITIAL_ESTIMATE_DEFAULT * 60,
        optimisticMin: INITIAL_ESTIMATE_DEFAULT,
        actualMinutes: nextActual,
        allocatedMin: nextActual,
        endTime: null,
        startTime: undefined,
        completedAt: undefined,
        completedRecordId: undefined,
        actualSeconds: undefined,
        tagline: undefined,
        wasAnnounced: undefined,
        isOvertimeAcknowledged: false,
        extensionCount: 0,
        activeMission: null,
        // category: state.category  ← intentionally NOT carried; SetupScreen re-guesses from new task name
        taxMultiplier: state.taxMultiplier,
        transitionMinutes: state.transitionMinutes,
        isExactTime: state.isExactTime,
        isMicroStep: false,
        personalFactor: null, // Will be re-computed by SetupScreen when new task name is entered
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

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // SSR-safe startup and lifecycle reconciliation
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Log metrics on initial mount for debugging
    console.group('📊 Time-Blindness Translator Local Analytics');
    console.table(getRetentionMetrics());
    console.table(getAccuracyImprovement());
    console.groupEnd();

    function handleReconcile() {
      const recovered = reconcileMission();
      if (recovered) {
        dispatch({ type: 'RECOVER_MISSION', payload: recovered });
      }
    }

    function handleOnline() {
      import('../lib/notifications/pendingActions').then(({ flushPendingActions }) => {
        flushPendingActions();
      });
    }

    // Initial startup
    handleReconcile();
    handleOnline();

    // Browser lifecycle events
    window.addEventListener('focus', handleReconcile);
    window.addEventListener('pageshow', handleReconcile);
    window.addEventListener('online', handleOnline);
    
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        handleReconcile();
        handleOnline();
        const currentState = stateRef.current;
        if (currentState.activeMission && (currentState.activeMission.status === 'running' || currentState.activeMission.status === 'paused')) {
          trackEvent('return_to_mission', { taskName: currentState.activeMission.taskName });
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    function handleMessage(event: MessageEvent) {
      if (event.data && event.data.type === 'NOTIFICATION_CLICKED') {
        trackEvent('notification_clicked', event.data.payload);
      }
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
    }

    return () => {
      window.removeEventListener('focus', handleReconcile);
      window.removeEventListener('pageshow', handleReconcile);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      }
    };
  }, []);

  // Awareness Events Watcher
  useEffect(() => {
    if (state.status !== 'active' || !state.activeMission || state.activeMission.status === 'paused') return;

    const intervalId = window.setInterval(() => {
      if (state.status !== 'active' || !state.activeMission) return;
      
      const now = Date.now();
      const events = getMissionAwarenessEvents(state.activeMission, now);
      
      let badgeSet = false;
      for (const event of events) {
        sendAwarenessNotification(state.activeMission, event.id, event.title, event.message);
        if (event.requiresAttention && !badgeSet) {
          setAppBadge(1);
          badgeSet = true;
        }
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [state.status, state.activeMission]);

  // Push Notification QStash Scheduler
  const prevMissionRef = useRef<any>(null);
  
  useEffect(() => {
    const prev = prevMissionRef.current;
    const curr = state.activeMission;
    prevMissionRef.current = curr;

    import('../lib/notifications/pushManager').then(({ scheduleMissionNotification, cancelMissionNotification }) => {
      // 1. If mission was cleared (completed/cancelled)
      if (!curr && prev && prev.notificationMessageId) {
        cancelMissionNotification(prev.notificationMessageId);
        return;
      }

      if (!curr) return;

      // 2. If mission was paused, or expired
      if (curr.status === 'paused' || state.status === 'expired') {
         if (curr.notificationMessageId) {
            cancelMissionNotification(curr.notificationMessageId);
         }
         return;
      }

      // 3. If mission is running, check if expectedEndAt changed
      if (curr.status === 'running' && state.status === 'active') {
         const needsSchedule = !prev || prev.expectedEndAt !== curr.expectedEndAt || prev.status !== 'running';
         
         if (needsSchedule) {
            // Cancel the old one if it exists
            if (prev?.notificationMessageId) {
               cancelMissionNotification(prev.notificationMessageId);
            }

            // Only schedule if the user has opted-in via PushManager, handled gracefully if not supported/subscribed.
            scheduleMissionNotification(curr.id, curr.expectedEndAt, curr.notificationVersion).then((messageId) => {
               if (messageId && stateRef.current.activeMission?.id === curr.id) {
                 import('../lib/mission/storage').then(m => {
                   const latestMission = m.getActiveMission();
                   if (latestMission && latestMission.id === curr.id) {
                     latestMission.notificationMessageId = messageId;
                     m.setActiveMission(latestMission);
                     dispatch({ type: 'SET_NOTIFICATION_MESSAGE_ID', payload: messageId });
                   }
                 });
               }
            });
         }
      }
    });
  }, [state.activeMission, state.status]);

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
