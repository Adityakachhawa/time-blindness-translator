/**
 * app/reset-my-day/lib/sequencer.ts
 *
 * Pure, deterministic sequencing algorithm for the Reset My Day recovery plan.
 * No side effects. All inputs are explicit. Fully unit-testable.
 *
 * Bucket definitions:
 *   DO_NOW   — first important task that fits the remaining budget
 *   THEN     — subsequent important tasks that fit the remaining budget
 *   OPTIONAL — optional tasks that fit once important tasks are accounted for
 *   SKIP     — tasks that don't fit the available budget
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskPriority = 'important' | 'optional';
export type BucketKey = 'DO_NOW' | 'THEN' | 'OPTIONAL' | 'SKIP';

export interface RmdTask {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** User-assigned priority */
  priority: TaskPriority;
  /**
   * Estimated duration in minutes.
   * For tasks with history: the historical median.
   * For tasks without history: the user's rough estimate.
   */
  estimatedMinutes: number;
  /**
   * Whether this estimate came from historical data.
   * Affects display ("Based on your history" vs user estimate).
   */
  hasHistory: boolean;
  /**
   * Historical range string for display, e.g. "Usually 35–45 min".
   * Only present when hasHistory === true.
   */
  historicalRange?: string;
  /** The user-defined order within their priority group */
  userOrder: number;
}

export interface SequencedTask extends RmdTask {
  bucket: BucketKey;
}

export interface RecoveryPlan {
  doNow: SequencedTask[];
  then: SequencedTask[];
  optional: SequencedTask[];
  skip: SequencedTask[];
  /** Total minutes allocated to DO_NOW + THEN tasks */
  committedMinutes: number;
  /** Available budget in minutes */
  budgetMinutes: number;
}

// ---------------------------------------------------------------------------
// Algorithm
// ---------------------------------------------------------------------------

/**
 * Sequences tasks into a deterministic recovery plan.
 *
 * Rules (strictly in order):
 * 1. Important tasks sorted by userOrder, then optional tasks by userOrder.
 * 2. Walk the ordered list, maintaining a running `remaining` budget.
 * 3. First important task that fits → DO_NOW.
 * 4. Subsequent important tasks that fit → THEN.
 * 5. After all important tasks are placed, optional tasks that fit → OPTIONAL.
 * 6. Any task (important or optional) that does not fully fit → SKIP.
 *
 * A task "fits" when estimatedMinutes <= remaining budget.
 *
 * @param tasks         Input tasks (unordered).
 * @param budgetMinutes Available usable time in minutes.
 * @returns             A RecoveryPlan with tasks sorted into buckets.
 */
export function buildRecoveryPlan(
  tasks: RmdTask[],
  budgetMinutes: number,
): RecoveryPlan {
  if (tasks.length === 0 || budgetMinutes <= 0) {
    return {
      doNow: [],
      then: [],
      optional: [],
      skip: tasks.map((t) => ({ ...t, bucket: 'SKIP' as BucketKey })),
      committedMinutes: 0,
      budgetMinutes,
    };
  }

  // Step 1: Partition and stable-sort by userOrder within each priority.
  const importantTasks = tasks
    .filter((t) => t.priority === 'important')
    .sort((a, b) => a.userOrder - b.userOrder);

  const optionalTasks = tasks
    .filter((t) => t.priority === 'optional')
    .sort((a, b) => a.userOrder - b.userOrder);

  // Step 2: Walk important tasks first.
  const doNow: SequencedTask[] = [];
  const then: SequencedTask[] = [];
  const optional: SequencedTask[] = [];
  const skip: SequencedTask[] = [];

  let remaining = budgetMinutes;

  for (const task of importantTasks) {
    if (task.estimatedMinutes <= remaining) {
      remaining -= task.estimatedMinutes;
      if (doNow.length === 0) {
        doNow.push({ ...task, bucket: 'DO_NOW' });
      } else {
        then.push({ ...task, bucket: 'THEN' });
      }
    } else {
      skip.push({ ...task, bucket: 'SKIP' });
    }
  }

  // Step 3: Walk optional tasks.
  for (const task of optionalTasks) {
    if (task.estimatedMinutes <= remaining) {
      remaining -= task.estimatedMinutes;
      optional.push({ ...task, bucket: 'OPTIONAL' });
    } else {
      skip.push({ ...task, bucket: 'SKIP' });
    }
  }

  const committedMinutes = budgetMinutes - remaining;

  return {
    doNow,
    then,
    optional,
    skip,
    committedMinutes,
    budgetMinutes,
  };
}
