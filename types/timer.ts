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

  /** ADHD Tax multiplier – 1.0 (mild) to 2.5 (severe). */
  taxMultiplier: number;

  /**
   * Buffered time after applying the tax multiplier, rounded to the
   * nearest 5 minutes.  This is the real countdown duration.
   */
  actualMinutes: number;

  /**
   * Absolute timestamp (ms since epoch) when the timer should fire.
   * Only populated while status === 'active'.
   */
  endTime: number | null;

  /**
   * Timestamp when the user clicked "I Did It!".
   * Only populated while status === 'success'.
   */
  completedAt?: number;

  /**
   * A randomly selected humorous tagline shown on the Adulting Certificate.
   * Only populated while status === 'success'.
   */
  tagline?: string;
}

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

/** Discriminated union of every action the reducer handles. */
export type TimerAction =
  | UpdateSetupAction
  | StartMissionAction
  | CompleteMissionAction
  | ExpireTimerAction
  | AddTenMinutesAction;
