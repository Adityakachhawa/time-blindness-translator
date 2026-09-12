# Time-Blindness Translator — PWA Reliability & Implementation Specification

## Purpose

This document is the source-of-truth implementation plan for an AI coding agent working on **Time-Blindness Translator**.

The immediate objective is to turn the existing Next.js web app into a **polished, reliable, installable PWA** that behaves as much like a mobile app as the web platform permits.

The most important user problem to solve is:

> A user starts a mission, switches to another app or locks the phone, and later discovers that the timer froze, disappeared, or never reminded them.

The implementation must solve the **timer correctness and mission recovery problem completely**, then provide the best possible background awareness using supported web APIs.

The product must remain **local-first and private**. No backend should be introduced during this phase.

---

# 1. Existing Product Context

## Stack

- Next.js 16 App Router
- TypeScript
- Local-first architecture
- `localStorage` currently used for persistence
- `@ducanh2912/next-pwa` for PWA shell/service worker

## Existing features

- Tiered Calibration Engine
  - Exact task name match
  - Broad category match
  - Manual fallback
- **Can I fit this in?**
- **Deadline Translation**
- **Make it Tiny**
- Weekly **Time Reality** report

## Product thesis

The product should not become another generic Pomodoro or task manager.

Its differentiated loop is:

```text
PREDICT
  ↓
CALIBRATE
  ↓
START MISSION
  ↓
DO THE TASK
  ↓
MEASURE REAL TIME
  ↓
COMPARE PREDICTION VS REALITY
  ↓
LEARN PERSONAL PATTERN
  ↓
MAKE THE NEXT PREDICTION BETTER
```

The mission timer is the execution layer of this loop.

---

# 2. Non-Negotiable Architecture Rules

## Rule 1 — Never count timer ticks

Do NOT use this as timer truth:

```ts
setInterval(() => {
  setRemaining((value) => value - 1)
}, 1000)
```

Intervals can be throttled or suspended when a page is backgrounded.

Instead, store absolute timestamps:

```ts
startedAt: number
expectedEndAt: number
```

Then derive state from the clock:

```ts
const now = Date.now()
const remainingMs = expectedEndAt - now
const elapsedMs = now - startedAt
```

`setInterval()` or `requestAnimationFrame()` may update the visible countdown while the page is active, but they must **never define elapsed time**.

## Rule 2 — React state is not durable mission state

An active mission must be persisted immediately. It must survive:

- app switch
- screen lock
- browser suspension
- reload
- PWA close/reopen
- temporary process termination

## Rule 3 — One source of truth

Only one mission engine determines mission state.

Do not let individual React components implement their own timing logic.

## Rule 4 — Background behavior must be honest

Do not promise exact-time notification delivery when a PWA is fully suspended.

Pure local web APIs do not provide a dependable cross-platform guarantee for an exact future notification while the web app is completely suspended.

Use layered best-effort behavior:

1. Correct timestamp-based timer
2. Foreground UI
3. Screen Wake Lock while visible, when supported
4. Service-worker notifications when the platform invokes the service worker
5. Catch-up notification when the app becomes active again
6. App Badging where supported

A future server-backed Web Push system is explicitly out of scope for this phase.

---

# 3. Target Project Structure

Adapt this to the existing repository rather than blindly creating duplicate systems.

```text
src/
  lib/
    mission/
      types.ts
      storage.ts
      createMission.ts
      loadMission.ts
      saveMission.ts
      getMissionState.ts
      getMissionTiming.ts
      startMission.ts
      pauseMission.ts
      resumeMission.ts
      completeMission.ts
      extendMission.ts
      reconcileMission.ts

    notifications/
      permission.ts
      notificationManager.ts
      notificationPolicy.ts
      notificationActions.ts

    wake-lock/
      wakeLockManager.ts

    calibration/
      calibrationEngine.ts

    analytics/
      localAnalytics.ts
```

Do not duplicate existing abstractions. Extend the existing architecture when possible.

---

# 4. Mission Data Model

Create one canonical active-mission type.

Example:

```ts
export type MissionStatus =
  | "running"
  | "paused"
  | "completed"
  | "cancelled"

export interface ActiveMission {
  id: string
  taskName: string
  startedAt: number
  plannedDurationMs: number
  expectedEndAt: number
  status: MissionStatus
  pausedAt?: number
  totalPausedMs?: number
  actualCompletedAt?: number
  calibratedDurationMs?: number
  originalEstimateMs?: number
  reminderPolicy?: "important" | "minimal" | "off"
  createdAt: number
  updatedAt: number
}
```

Keep the model minimal. Add fields only when required by a feature.

---

# 5. Timer Mathematics

For a running mission:

```ts
const now = Date.now()
const elapsedMs = now - mission.startedAt
const remainingMs = mission.expectedEndAt - now
const overtimeMs = Math.max(0, now - mission.expectedEndAt)
```

The visible timer is derived from these values.

## Mission phases

Use explicit states such as:

```text
RUNNING
PAUSED
OVERTIME
COMPLETED
CANCELLED
```

A running mission becomes `OVERTIME` when `Date.now() >= expectedEndAt`.

Do not treat an overrun as failure.

---

# 6. Pause Semantics

Use one consistent definition:

> Pausing stops the mission clock and extends the expected end time by the paused duration.

Example:

```text
Start: 10:00
Budget: 30 min
Expected end: 10:30

Pause: 10:12
Resume: 10:20

Paused: 8 min
New expected end: 10:38
```

All UI, history and calibration code must use the same semantics.

---

# 7. Storage Strategy

## `localStorage`

Use for small, immediately-needed state such as:

- active mission
- small preferences
- feature flags

## IndexedDB

Prefer IndexedDB for growing collections:

- completed mission history
- calibration observations
- weekly-report source data
- larger analytics records

Hide storage implementation behind an interface where practical:

```ts
interface MissionStorage {
  getActiveMission(): Promise<ActiveMission | null>
  setActiveMission(mission: ActiveMission): Promise<void>
  clearActiveMission(): Promise<void>
}
```

The core product must continue working offline.

---

# 8. Phase 0 — Audit Before Coding

The coding agent MUST inspect the repository before changing implementation.

Identify:

1. Current timer component/hook
2. Current timer source of truth
3. Current mission persistence
4. Current calibration storage
5. Current PWA configuration
6. Current service worker configuration
7. Existing notification code
8. Existing app lifecycle handling
9. Existing tests
10. Existing feature boundaries

Before making a large refactor, produce a concise report:

- what exists
- what can be reused
- what must change
- what files will be added/modified
- potential regressions

Do not rewrite working product features unnecessarily.

---

# 9. Phase 1 — Build the Reliable Mission Engine

This must be completed before notification work.

## Step 1 — Create/start mission

When the user presses **Start Mission**:

1. Resolve original estimate.
2. Resolve calibrated estimate.
3. Choose the mission budget.
4. Create a unique mission ID.
5. Set `startedAt = Date.now()`.
6. Set `expectedEndAt = startedAt + plannedDurationMs`.
7. Persist immediately.
8. Navigate to mission mode.
9. Start foreground display updates.
10. Attempt Wake Lock later in the lifecycle, but do not make it required.

## Step 2 — Render countdown

Display time using:

```ts
remainingMs = expectedEndAt - Date.now()
```

Use an interval only to refresh the screen.

## Step 3 — Complete mission

On completion:

1. Capture `actualCompletedAt`.
2. Calculate actual duration.
3. Store completed observation.
4. Update calibration inputs.
5. Clear active mission.
6. Clear badge if available.
7. Show prediction-vs-reality result.

## Step 4 — Recovery

On app startup:

```text
load active mission
        ↓
none? → normal home
        ↓
yes
        ↓
calculate current state
        ↓
running? → Resume Mission
expired? → Reality Check / Overtime
completed? → clean up
```

Never silently discard an active mission.

---

# 10. Phase 2 — Lifecycle Reconciliation

Implement one idempotent function:

```ts
reconcileMission()
```

Invoke it on:

- app startup
- `visibilitychange`
- `focus`
- `pageshow`
- mission screen mount
- navigation back into the app

Algorithm:

```text
Load active mission
      ↓
Read Date.now()
      ↓
Calculate mission state
      ↓
Update store/UI
      ↓
If mission expired:
  process expiry exactly once
      ↓
Update badge/notification state
```

The function must be safe to call repeatedly.

It must not:

- reset timestamps
- double-complete missions
- produce duplicate notifications
- create duplicate history entries

---

# 11. Phase 3 — Notification Idempotency

Every notification event needs a stable event key.

Examples:

```text
mission:{id}:halfway
mission:{id}:time-up
mission:{id}:overtime
```

Track whether each event has already been emitted/handled.

This prevents duplicate alerts caused by:

- `visibilitychange`
- `focus`
- `pageshow`
- route changes
- React remounts

---

# 12. Phase 4 — Wake Lock

Use the Screen Wake Lock API only while the mission is visible and the user is actively using Mission Mode.

Example:

```ts
let wakeLock: WakeLockSentinel | null = null

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) return

  try {
    wakeLock = await navigator.wakeLock.request("screen")
  } catch {
    // Non-fatal fallback.
  }
}
```

Lifecycle:

```text
Mission starts while visible
        ↓
request Wake Lock
        ↓
App becomes hidden
        ↓
Lock may be released by platform
        ↓
App becomes visible again
        ↓
request Wake Lock again
```

Release it when:

- mission completes
- mission is paused
- mission is cancelled
- app no longer needs Mission Mode

Wake Lock is a foreground screen-preservation feature. It must not be treated as a background JavaScript execution mechanism.

---

# 13. Phase 5 — Service Worker and Notifications

Keep notification calls behind one service such as:

```ts
notificationManager
```

Do not scatter notification logic through components.

## Notification permission

Do not request permission on first page load.

Request after the user understands the benefit:

```text
Want a reminder when your mission needs attention?

[Enable mission reminders]
```

If denied:

- app remains fully usable
- do not repeatedly prompt
- allow later settings access
- rely on in-app reconciliation

## Notification categories

Keep notifications meaningful rather than noisy.

Recommended initial events:

### Time up

> Time check — Clean your room
>
> Your planned time is up.

### Overtime

> Still working on Clean your room?
>
> You're about 5 minutes beyond your budget.

Avoid minute-by-minute notifications.

---

# 14. Critical Web Platform Constraint

Do not attempt to use a browser timer as a guarantee that the service worker will wake up exactly at `expectedEndAt`.

Do not design the product around Notification Triggers or other experimental/deprecated mechanisms.

Do not claim:

> "Exact-time local notifications work even when the PWA is fully closed on every device."

The architecture must instead guarantee **correct state** and provide best-effort background awareness.

Useful references:

- MDN Screen Wake Lock API: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
- MDN Notifications API: https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API
- MDN Push API: https://developer.mozilla.org/en-US/docs/Web/API/Push_API
- WebKit Web Push for Home Screen Web Apps: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

---

# 15. Phase 6 — Catch-Up Notification

This is the core local-only background fallback.

When the app becomes active:

```text
Load mission
      ↓
expectedEndAt < Date.now()
      ↓
time-up has not been acknowledged
      ↓
show catch-up notification where supported
      ↓
set app badge
      ↓
show Overtime / Reality Check screen
```

Example:

> **Time check**
>
> Clean your room
>
> You budgeted 25 minutes and are now about 7 minutes over.
>
> **Open mission**

The notification should deep-link back to the mission.

---

# 16. Phase 7 — Notification Click Handling

Service worker notification clicks should open/focus the correct mission.

Conceptually:

```ts
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  event.waitUntil(
    clients.openWindow(
      `/mission/${event.notification.data.missionId}`
    )
  )
})
```

Prefer focusing an existing client/window when possible instead of opening unnecessary duplicates.

Support actions later such as:

- Open Mission
- Done
- +10 min

Only add actions that work consistently on the target browsers.

---

# 17. Phase 8 — App Badging

Use App Badging as a persistent attention cue.

When mission needs attention:

```ts
navigator.setAppBadge?.(1)
```

When resolved:

```ts
navigator.clearAppBadge?.()
```

Do not attempt to display a live countdown as a badge.

Use:

```text
1 = mission needs attention
```

rather than:

```text
24 → 23 → 22 → 21
```

Always feature-detect the API.

---

# 18. Phase 9 — Mission UX

The mission screen should feel like a mobile application rather than a normal webpage.

Recommended hierarchy:

```text
< Back

CLEAN MY ROOM

Your reality budget
28 min

18:42 elapsed
09:18 remaining

████████████████░░░

Keep going.
Don't optimize the task.

[ Pause ]    [ Done ]
```

Near the end:

```text
03:00 remaining

You're in the final stretch.
Finish the easiest remaining part.
```

At expiry:

```text
REALITY CHECK

You budgeted: 28 min
Actual so far: 31 min
You're 3 min over.

[ I'm Done ]
[ Keep Going +10 ]
[ Recalculate ]
```

The language should be calm and non-judgmental.

---

# 19. Background Return UX

When the user returns after leaving the PWA:

## Still within budget

```text
Welcome back 👋

CLEAN MY ROOM

You budgeted 28 min.
You've been away for 6 min.

18 min remaining.

[ Resume Mission ]
```

## Over budget

```text
Welcome back 👋

Your budget expired.

CLEAN MY ROOM
Budget: 28 min
Elapsed: 34 min

You're 6 min over.

[ I'm Done ]
[ Keep Going ]
[ Recalculate ]
```

Never render a stale countdown.

---

# 20. Persistent Active Mission UI

The active mission should remain accessible throughout the application.

Example compact banner:

```text
┌─────────────────────────────┐
│ 🟠 Clean my room            │
│ 18 min remaining            │
│ Tap to resume               │
└─────────────────────────────┘
```

This prevents the user from forgetting that a mission exists while navigating around the PWA.

---

# 21. One Active Mission in the First Reliable Version

Support only one active mission initially.

Rules:

```text
No active mission → start allowed
Active mission → resume/manage existing mission
```

If the user tries to start another mission:

> You're already on a mission. Finish or pause the current task first.

Do not introduce multi-task background scheduling yet.

---

# 22. PWA Quality

Verify the PWA has:

- valid manifest
- stable `id`
- `name`
- `short_name`
- `start_url`
- `scope`
- `display: standalone` or appropriate app-like mode
- theme/background color
- correct icons
- maskable icon where appropriate
- working service worker
- appropriate cache strategy
- offline app shell
- controlled service-worker update behavior

Do not let stale caches override durable mission state.

Mission state must come from local persistence + timestamps.

---

# 23. App Icon Direction

Use the clean hourglass identity as the primary application icon.

The icon should be:

- simple
- recognizable at launcher size
- centered
- text-free
- consistent with coral + sage visual language
- appropriate for rounded/masked platforms

The detailed hourglass illustration can be used for:

- landing page hero
- onboarding
- marketing
- empty states

Do not use a very detailed illustration as the only small launcher icon.

---

# 24. Offline-First Requirement

Core mission flow must work without internet.

Required offline path:

```text
Open PWA
→ create mission
→ start mission
→ lose internet
→ background or lock device
→ reopen
→ correct elapsed time
→ complete mission
→ save result locally
```

No core mission action should require a server.

---

# 25. Integrate Actual-vs-Estimated Learning

After mission completion record:

```text
taskName
category
originalEstimateMs
calibratedEstimateMs
actualDurationMs
startedAt
completedAt
```

Calculate:

```text
signed error
absolute error
actual / original estimate
actual / calibrated estimate
```

Example:

```text
Original estimate: 15m
Calibrated estimate: 27m
Actual: 31m

Original error: +107%
Calibrated error: +15%
```

Feed these observations into the existing calibration engine.

Do not replace the existing tiered system with an unrelated model.

---

# 26. Extend the Existing Tiered Calibration System

Preserve this hierarchy:

```text
1. Exact task match
2. Broad category match
3. User fallback
```

Add completed mission observations.

Example:

```text
Task: Get ready for college

Observed:
20m
31m
28m
34m

Recent range: 28–34m
Recommended budget: ~32m
```

Do not draw strong personal conclusions from only one or two observations.

Use sensible minimum sample sizes and confidence language.

---

# 27. Integrate "Can I Fit This In?"

Use personal history when enough data exists.

Example:

```text
You have 20 minutes.

Your recent range:
22–31 min

Recommendation:
Not comfortably.

Try the 10-minute version instead.
```

This connects calibration to action.

---

# 28. Integrate Deadline Translation

Use calibrated duration + an explicit buffer.

Example:

```text
Deadline: 9:00 PM
Task: Study chemistry
Personal realistic budget: 58m
Setup/transition buffer: 7m

Recommended start: 7:55 PM
```

Then allow the resulting task to become a normal mission.

Do not maintain separate timer logic.

---

# 29. Integrate "Make It Tiny"

If a task is too large:

```text
This looks like a 75-minute task.

Instead of starting with 75 minutes:

5 min setup
15 min first block
5 min reset
15 min second block
```

Each executable block can become a mission.

---

# 30. Weekly Time Reality Report

Use completed missions as the primary source of truth.

Track, where statistically meaningful:

- original estimate accuracy
- calibrated estimate accuracy
- average underestimation
- task count
- improvement over time
- high-distortion categories

Focus the report on **better understanding of personal time**, not raw productivity quantity.

---

# 31. Accessibility

Mission state must never be communicated by color alone.

Use:

```text
ON TIME
TIME'S UP
OVERTIME
```

plus icons/visual progress.

Support:

- keyboard interaction
- screen readers
- reduced motion
- sufficient contrast
- large touch targets

Respect:

```css
@media (prefers-reduced-motion: reduce) {
  /* reduce/disable non-essential animation */
}
```

The timer must remain understandable without animation.

---

# 32. Sound / Haptic Feedback

These are optional layers, not requirements.

Preferences may eventually include:

```text
Mission alerts
[ ] Sound
[ ] Haptic/vibration where supported
[ ] Visual only
```

Avoid excessive alerts.

The product should create time awareness without creating anxiety.

---

# 33. Tone and Behavioral Design

Never shame the user for inaccurate estimates.

Avoid:

- "You failed."
- "You wasted time."
- "You're terrible at time management."

Prefer:

- "Reality was different."
- "That estimate was optimistic."
- "Let's recalibrate."
- "Want to give this another 10 minutes?"

Overtime is data, not failure.

---

# 34. Privacy

Core user information must stay local:

- task names
- mission history
- calibration observations
- time profile

Do not send these to external APIs or analytics in this phase.

Do not add accounts merely to support retention.

Any future cloud feature must be explicit and opt-in.

---

# 35. Developer Diagnostics

Create a development-only PWA diagnostics view.

Example:

```text
PWA DIAGNOSTICS

Service Worker: READY
Local Storage: OK
IndexedDB: OK
Notifications: GRANTED
Wake Lock: SUPPORTED
Badging: SUPPORTED

Active Mission: YES
State: OVERTIME

Started: 18:21
Expected End: 18:49
Now: 18:55

Last Reconciliation: 18:55:12
```

This will make device-specific bugs much easier to investigate.

Do not expose diagnostics to normal users without a developer flag.

---

# 36. Structured Development Logging

During development, log structured events such as:

```text
mission_created
mission_started
mission_paused
mission_resumed
mission_reconciled
mission_expired
mission_completed
mission_recovered
notification_permission_requested
notification_emitted
notification_suppressed_duplicate
wake_lock_requested
wake_lock_released
```

Avoid logging private task names in production diagnostics unless explicitly needed.

---

# 37. Testing Matrix

The feature is not done after desktop browser testing.

## Test 1 — Switch applications

```text
Start 10-minute mission
Switch to another app for 3 minutes
Return
```

Expected:

```text
elapsed ≈ 3 minutes
```

Never:

```text
elapsed ≈ 0
```

## Test 2 — Lock screen

```text
Start mission
Lock phone
Wait
Unlock
```

Expected:

```text
correct elapsed/remaining state
```

## Test 3 — Reload

```text
Start
Reload
```

Expected:

```text
mission recovered
```

## Test 4 — Close/reopen PWA

```text
Start
Close PWA
Wait
Open again
```

Expected:

```text
mission recovered
```

## Test 5 — Expire while backgrounded

```text
Start 2-minute mission
Background
Wait >2 minutes
Open
```

Expected:

```text
overtime/reality-check state
catch-up notification where supported
badge where supported
```

## Test 6 — Offline

Core mission must continue while offline.

## Test 7 — Duplicate lifecycle events

Trigger several `visibilitychange`, `focus`, and `pageshow` events.

Expected:

```text
no duplicate notifications
no duplicate completion records
no corrupted mission state
```

## Test 8 — Clock changes

Test abnormal wall-clock changes where practical and document the chosen behavior.

Do not silently assume the system clock can never change.

---

# 38. Required Device Matrix

Use real devices.

## Android

- Chrome Android
- installed PWA

## iOS

- Safari
- installed Home Screen PWA

## Desktop

- Chrome
- Edge
- Safari where practical

For each target:

```text
foreground
background
screen lock
reopen
notification permission
notification click
badge
Wake Lock
offline
```

Document platform differences rather than pretending all browsers are identical.

---

# 39. Do NOT Build Yet

During this reliability phase, do not add:

- native iOS app
- native Android app
- accounts
- cloud sync
- social features
- team features
- large calendar system
- giant task manager
- AI chat assistant
- multiple simultaneous missions
- elaborate gamification
- leaderboard

These can be reconsidered after real usage data proves the need.

---

# 40. Exact Implementation Order

The coding agent MUST follow this sequence.

## Phase 0

Repository audit only.

## Phase 1

Reliable Mission Engine:

1. Mission data model
2. Timestamp timing
3. Durable persistence
4. Start/pause/resume/complete
5. Startup recovery

## Phase 2

Reconciliation:

1. `reconcileMission()`
2. visibility handling
3. focus handling
4. pageshow handling
5. idempotency

## Phase 3

PWA reliability:

1. manifest
2. service worker
3. installability
4. standalone mode
5. offline shell
6. update strategy

## Phase 4

Wake Lock:

1. request on visible mission
2. release on pause/complete
3. re-request after visibility return
4. graceful fallback

## Phase 5

Notifications:

1. contextual permission UX
2. notification manager
3. service-worker notification support
4. event IDs
5. catch-up notification
6. notification click/focus behavior

## Phase 6

Badging:

1. set when attention required
2. clear when resolved
3. feature detection

## Phase 7

Mission UX:

1. persistent active mission banner
2. resume screen
3. overtime state
4. reality-check screen
5. extension/recalculation
6. accessibility

## Phase 8

Calibration integration:

1. actual duration capture
2. prediction error
3. task-level observations
4. category-level observations
5. improved recommendations

## Phase 9

Retention measurement:

Track:

- mission starts
- mission completions
- return-to-mission events
- repeat use
- notification interactions
- prediction accuracy improvement
- 1-day retention
- 7-day retention
- 30-day retention

Do not assume that a feature improves retention; measure it.

---

# 41. Definition of Done

## Reliability

- [ ] Timestamp-based timer is the source of truth.
- [ ] Active mission persists locally.
- [ ] Refresh does not lose mission.
- [ ] Backgrounding does not corrupt time.
- [ ] Locking screen does not corrupt time.
- [ ] Reopening PWA restores state.
- [ ] Core mission works offline.
- [ ] One canonical mission engine exists.

## PWA

- [ ] PWA installs.
- [ ] Standalone mode works.
- [ ] Manifest is correct.
- [ ] Icons are correct.
- [ ] Service worker is functioning.
- [ ] Offline shell works.

## Background awareness

- [ ] Wake Lock works where supported.
- [ ] Permission UX is contextual.
- [ ] Catch-up notification works where supported.
- [ ] Notification click returns to mission.
- [ ] Duplicate notifications are prevented.
- [ ] Badge works where supported.
- [ ] Unsupported APIs fail gracefully.

## UX

- [ ] Mission screen feels app-like.
- [ ] Active mission is always recoverable.
- [ ] Overtime is not framed as failure.
- [ ] User can finish, extend, or recalculate.
- [ ] Reduced motion is respected.
- [ ] Accessibility does not depend on color.

## Calibration

- [ ] Actual duration is recorded.
- [ ] Prediction vs reality is shown.
- [ ] Existing calibration engine consumes mission observations.
- [ ] Recommendations improve as data accumulates.
- [ ] Small sample sizes are treated cautiously.

## Privacy

- [ ] Core user data stays local.
- [ ] No login is required.
- [ ] Task content is not accidentally transmitted.
- [ ] Privacy claims accurately match implementation.

---

# 42. Prompt Template for AI Coding Agents

Use this after giving the agent the specification above:

```text
Read TIME-BLINDNESS-TRANSLATOR-PWA-IMPLEMENTATION-SPEC.md before changing the repository.

Implement ONLY the requested phase. Do not skip ahead.

First inspect the existing codebase and report:
- current mission/timer architecture
- current persistence/storage
- current PWA/service worker setup
- existing calibration implementation
- files that should be modified
- files that should be created
- compatibility risks

Then implement the phase with minimal unrelated refactoring.

Core constraints:
- Next.js 16 App Router
- TypeScript
- local-first
- no backend
- no accounts
- no cloud database
- preserve all existing features
- timer truth must use absolute timestamps
- timer must remain correct when JavaScript is suspended
- React render/update loops are not the source of timer truth
- all APIs must be feature-detected and fail gracefully

After implementation:
1. Run typecheck.
2. Run lint.
3. Run tests.
4. Run production build.
5. Report exact files changed.
6. Report any unresolved issues.
7. Provide manual device tests needed.

Do not proceed to the next phase until the current phase passes its acceptance criteria.
```

---

# 43. Recommended Phase-Specific Prompts

## Prompt — Phase 1

```text
Read the PWA implementation specification.

Implement ONLY Phase 1: Reliable Mission Engine.

Inspect the existing timer and storage code first.

Replace interval-based timer truth with timestamp-based timing.

Implement:
- canonical ActiveMission model
- durable active-mission persistence
- start
- pause
- resume
- complete
- startup recovery
- elapsed/remaining/overtime calculations

Do not implement notifications or Wake Lock yet.

Acceptance test:
Start a mission, reload the app, and verify that elapsed time is based on real wall-clock time instead of interval ticks.
```

## Prompt — Phase 2

```text
Read the PWA implementation specification.

Implement ONLY Phase 2: lifecycle reconciliation.

Create an idempotent reconcileMission() flow.

Handle:
- startup
- visibilitychange
- focus
- pageshow

The mission must become the correct state immediately when the app returns from background.

Prevent duplicate completion records and duplicate notification state.

Do not implement new notification delivery yet.
```

## Prompt — Phase 4

```text
Read the PWA implementation specification.

Implement ONLY Wake Lock support for Mission Mode.

Requirements:
- request while mission is visible
- gracefully handle unsupported browsers
- gracefully handle rejection
- release on pause/complete
- re-request after visibility returns
- never make Wake Lock necessary for timer correctness

Run build/typecheck/lint after implementation.
```

## Prompt — Phase 5

```text
Read the PWA implementation specification.

Implement ONLY the notification layer.

Requirements:
- contextual permission request
- notification manager abstraction
- service-worker notification support
- stable mission event IDs
- catch-up time-up notification after returning to the app
- notification click opens/focuses the correct mission
- no duplicate notifications

Do not claim exact-time local delivery while the PWA is fully suspended.
Do not add a backend.
```

---

# 44. Long-Term Product Direction

The final product should make this loop increasingly valuable:

```text
"I think this will take 15 minutes."
           ↓
"Based on your history, budget about 27."
           ↓
"Start Mission."
           ↓
User does the task
           ↓
"That took 31."
           ↓
"Your calibrated estimate was only 15% off."
           ↓
"Next time we'd budget about 30."
```

The product gets better because the **user's own time history gets better**.

That is the core retention mechanism.

---

# 45. Final Rule

The single most important reliability requirement is:

> **If the device suspends the PWA for 20 minutes, the mission must still be mathematically correct when the user returns.**

Everything else is layered on top of this.

Correctness first.

Then background awareness.

Then app-like UX.

Then calibration.

Then retention optimization.

Never reverse that order.
