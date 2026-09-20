// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export type TimerStatus = 'setup' | 'active' | 'success' | 'expired';

export type TaskCategory = 'work' | 'cleaning' | 'gettingReady' | 'study' | 'health' | 'other';


// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface TimerState {
  /** Which screen is currently active. */
  status: TimerStatus;

  /** What the user is working on. */
  taskName: string;

  /** The broad category of the task. */
  category?: TaskCategory;


  /** Raw estimate entered by the user (minutes). */
  initialEstimate: number;

  /** The initial guess in seconds */
  predictedSeconds?: number;

  /** Alias for initialEstimate for reporting */
  optimisticMin?: number;

  /** ADHD Tax multiplier – 1.0 (mild) to 2.5 (severe). */
  taxMultiplier: number;

  /** Personalized learning factor based on user history */
  personalFactor?: number | null;

  /** Whether the user has chosen to override the smart factor manually */
  isManualOverride?: boolean;

  /** True if the user hit 0 and chose to 'Keep going' in open-ended overtime */
  isOvertimeAcknowledged?: boolean;

  /** Time buffered for setup / transitions before the core task */
  transitionMinutes?: number;

  /**
   * When true the timer runs in Exact Time mode: no ADHD-tax multiplier,
   * no 5-minute rounding.  The countdown matches the user's raw estimate.
   */
  isExactTime?: boolean;

  /**
   * Buffered time after applying the tax multiplier, rounded to the
   * nearest 5 minutes.  This is the real countdown duration.
   */
  actualMinutes: number;

  /** Alias for actualMinutes for reporting — updated on extend/recalculate. */
  allocatedMin?: number;

  /**
   * The initial calibrated duration in minutes, captured at START_MISSION and
   * NEVER overwritten by extensions or recalculations.
   * This is the denominator for the accuracy calculation on SuccessScreen:
   *   accuracy = initialCalibratedMin vs coreActualMin
   */
  initialCalibratedMin?: number;

  /**
   * Absolute timestamp (ms since epoch) when the timer should fire.
   * Only populated while status === 'active'.
   */
  endTime: number | null;

  /** Timestamp when the timer was started */
  startTime?: number;

  /**
   * Timestamp when the user clicked "I Did It!".
   * Only populated while status === 'success'.
   */
  completedAt?: number;

  /** Exact number of seconds the task ran for */
  actualSeconds?: number;

  /**
   * A randomly selected humorous tagline shown on the Adulting Certificate.
   * Only populated while status === 'success'.
   */
  tagline?: string;

  /** Number of extensions used during this mission. */
  extensionCount: number;

  /** Whether the mission was announced via Witness Me. */
  wasAnnounced?: boolean;

  /** The durable active mission object. Only present if a mission is started. */
  activeMission?: any;

  /**
   * The localStorage record ID written by completeMission().
   * Passed into success state so SuccessScreen can look up exactly the right
   * record without assuming getTaskHistory()[0] is always correct.
   */
  completedRecordId?: string;

  /** Identifies if this task was initiated via the Start Me micro-step flow */
  isMicroStep?: boolean;
}

// ---------------------------------------------------------------------------
// Lifetime Stats & Certificate Themes
// ---------------------------------------------------------------------------

export interface LifetimeStats {
  totalTasks: number;
  totalMinutesSaved: number;
  totalExtensions: number;
}

export type CertTheme = 'classic' | 'dark' | 'chaos';

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Partial state update dispatched whenever the setup form changes.
 * All fields are optional — the reducer merges only what is provided.
 */
export interface UpdateSetupAction {
  type: 'UPDATE_SETUP';
  payload: Partial<Pick<TimerState, 'taskName' | 'category' | 'initialEstimate' | 'taxMultiplier' | 'personalFactor' | 'isManualOverride' | 'transitionMinutes' | 'isExactTime' | 'isMicroStep'>>;
}

/** Transitions from setup → active, setting an absolute endTime. */
export interface StartMissionAction {
  type: 'START_MISSION';
}

/** Transitions from active → success when the user clicks "I Did It!". */
export interface CompleteMissionAction {
  type: 'COMPLETE_MISSION';
}

/** Transitions from active → expired when the countdown reaches zero. */
export interface ExpireTimerAction {
  type: 'EXPIRE_TIMER';
}

/**
 * Transitions from expired → active, adding 10 shame-free bonus minutes
 * from the current moment (not from the old endTime).
 */
export interface AddTenMinutesAction {
  type: 'ADD_TEN_MINUTES';
}

/**
 * Adds bonus minutes during an active mission, pushing the endTime further.
 */
export interface AddMinutesAction {
  type: 'ADD_MINUTES';
  payload: { minutes: number } | number;
}

/**
 * Marks the active mission as having been announced publicly.
 */
export interface AnnounceMissionAction {
  type: 'ANNOUNCE_MISSION';
}

/** User clicked 'Keep going' when the timer hit zero. */
export interface AcknowledgeOvertimeAction {
  type: 'ACKNOWLEDGE_OVERTIME';
}

/**
 * Mark mission as paused.
 */
export interface PauseMissionAction {
  type: 'PAUSE_MISSION';
}

/**
 * Resume a paused mission.
 */
export interface ResumeMissionAction {
  type: 'RESUME_MISSION';
}

/**
 * Load recovered mission on startup
 */
export interface RecoverMissionAction {
  type: 'RECOVER_MISSION';
  payload: any;
}

/** Minimize a mission back to the setup view. */
export interface MinimizeMissionAction {
  type: 'MINIMIZE_MISSION';
}

/** Update the notification message ID from QStash */
export interface SetNotificationMessageIdAction {
  type: 'SET_NOTIFICATION_MESSAGE_ID';
  payload: string;
}

/** Recalculate the mission remaining time */
export interface RecalculateMissionAction {
  type: 'RECALCULATE_MISSION';
  payload: { remainingMinutes: number };
}

/**
 * Transitions from success → setup for a "chain task".
 * Clears task-specific fields but preserves session context
 * (category, taxMultiplier, transitionMinutes, isExactTime).
 * Does NOT reload the page — uses the existing state machine.
 */
export interface ChainMissionAction {
  type: 'CHAIN_MISSION';
  /** Optional next task name to pre-fill on SetupScreen. */
  payload?: { taskName?: string };
}

/** Discriminated union of every action the reducer handles. */
export type TimerAction =
  | UpdateSetupAction
  | StartMissionAction
  | CompleteMissionAction
  | ExpireTimerAction
  | AddTenMinutesAction
  | AddMinutesAction
  | AnnounceMissionAction
  | AcknowledgeOvertimeAction
  | PauseMissionAction
  | ResumeMissionAction
  | RecoverMissionAction
  | MinimizeMissionAction
  | SetNotificationMessageIdAction
  | RecalculateMissionAction
  | ChainMissionAction;
