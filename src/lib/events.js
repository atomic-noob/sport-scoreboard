import { db } from './db'
import { requestSync } from './syncEngine'

/**
 * Logs a match event locally (points, fouls, subs, timeouts, corrections, etc).
 * This is the single entry point for ANY scoring action in the app.
 *
 * Flow:
 *  1. Write to local IndexedDB immediately (instant UI, works offline)
 *  2. Kick off a sync attempt (no-op if offline, syncEngine handles retry)
 *
 * eventType examples: 'POINT', 'FOUL', 'TECH_FOUL', 'SUB_IN', 'SUB_OUT',
 * 'TIMEOUT', 'PERIOD_END', 'GAME_START', 'GAME_END', 'CORRECTION'
 *
 * payload shape depends on eventType, e.g. for POINT:
 * { playerId, teamId, points: 1|2|3, courtPosition? }
 *
 * For CORRECTION events, payload must include `correctsEventId` pointing
 * at the localId of the event being reversed, plus the replacement data.
 * Corrections are new events -- the original is never edited or deleted.
 */
export async function logEvent(matchId, eventType, payload, meta = {}) {
  const event = {
    localId: crypto.randomUUID(),
    matchId,
    eventType,
    payload,
    createdBy: meta.userId ?? null,
    createdAt: new Date().toISOString(),
    synced: false,
  }

  await db.pendingEvents.add(event)
  requestSync() // fire and forget -- syncEngine decides if it can actually run

  return event
}

/** Returns the full local event log for a match, in chronological order. */
export async function getMatchEvents(matchId) {
  return db.pendingEvents
    .where('matchId')
    .equals(matchId)
    .sortBy('createdAt')
}

/** Convenience: log a correction that reverses + replaces a prior event. */
export async function logCorrection(matchId, correctsEventId, replacementPayload, meta = {}) {
  return logEvent(
    matchId,
    'CORRECTION',
    { correctsEventId, replacement: replacementPayload },
    meta
  )
}
