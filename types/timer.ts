// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export type TimerStatus = 'setup' | 'active' | 'success' | 'expired';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface TimerState {
  /** Which screen is currently active. */
  status: TimerStatus;

  /** What the user is working on. */
  taskName: string;

  /** Raw estimate entered by the user (minutes). */
  initialEstimate: number;

  /** The initial guess in seconds */
  predictedSeconds?: number;

  /** Alias for initialEstimate for reporting */
  optimisticMin?: number;

  /** ADHD Tax multiplier – 1.0 (mild) to 2.5 (severe). */
  taxMultiplier: number;

  /**
   * Buffered time after applying the tax multiplier, rounded to the
   * nearest 5 minutes.  This is the real countdown duration.
   */
  actualMinutes: number;

  /** Alias for actualMinutes for reporting */
  allocatedMin?: number;

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
  payload: Partial<Pick<TimerState, 'taskName' | 'initialEstimate' | 'taxMultiplier'>>;
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

/** Discriminated union of every action the reducer handles. */
export type TimerAction =
  | UpdateSetupAction
  | StartMissionAction
  | CompleteMissionAction
  | ExpireTimerAction
  | AddTenMinutesAction
  | AddMinutesAction
  | AnnounceMissionAction;
