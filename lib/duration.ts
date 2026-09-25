/**
 * lib/duration.ts
 *
 * Source of truth for TBT mission duration boundaries.
 * 300 minutes is a strict domain invariant, not just a UI limit.
 */

export const MIN_TIMER_MINUTES = 1;
export const MAX_TIMER_MINUTES = 300;

/**
 * Normalizes a raw string input into a valid minute value,
 * falling back to the provided default if invalid.
 * Used for blur handlers in numeric inputs.
 */
export function parseTimerMinutes(raw: string, fallback: number): number {
  // Normalize leading zeroes by parsing as integer
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    return clampTimerMinutes(fallback);
  }
  return clampTimerMinutes(parsed);
}

/**
 * Clamps a number to the absolute domain boundary of [1, 300].
 */
export function clampTimerMinutes(value: number): number {
  return Math.max(MIN_TIMER_MINUTES, Math.min(MAX_TIMER_MINUTES, value));
}

/**
 * Checks if a numeric value is strictly within the valid range.
 */
export function isValidTimerMinutes(value: number): boolean {
  if (isNaN(value)) return false;
  return value >= MIN_TIMER_MINUTES && value <= MAX_TIMER_MINUTES;
}
