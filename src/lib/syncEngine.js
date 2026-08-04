import { db } from './db'
import { supabase } from './supabaseClient'

let syncing = false
let listenersAttached = false

/** Call once at app startup. Wires up auto-sync on reconnect. */
export function initSyncEngine() {
  if (listenersAttached) return
  listenersAttached = true

  window.addEventListener('online', requestSync)

  // Also retry periodically in case 'online' doesn't fire reliably
  // (some browsers/networks are flaky about this event).
  setInterval(requestSync, 15000)

  // Try once on startup in case we were offline when events were queued.
  requestSync()
}

/** Ask the sync engine to attempt a push. Safe to call often -- it's a no-op if already syncing or offline. */
export function requestSync() {
  if (!navigator.onLine || syncing) return
  syncPendingEvents()
}

async function syncPendingEvents() {
  syncing = true
  try {
    const unsynced = await db.pendingEvents
      .where('synced')
      .equals(0)
      .sortBy('createdAt')

    for (const event of unsynced) {
      const { error } = await supabase.from('match_events').insert({
        local_id: event.localId,
        match_id: event.matchId,
        event_type: event.eventType,
        payload: event.payload,
        created_by: event.createdBy,
        created_at: event.createdAt,
      })

      if (error) {
        // Stop on first failure (likely connection dropped mid-sync).
        // Remaining events stay queued and will retry next pass.
        console.warn('Sync failed, will retry later:', error.message)
        break
      }

      await db.pendingEvents.update(event.id, { synced: true })
    }
  } finally {
    syncing = false
  }
}

/** Number of events still waiting to sync -- useful for a "syncing..." UI indicator. */
export async function pendingSyncCount() {
  return db.pendingEvents.where('synced').equals(0).count()
}
