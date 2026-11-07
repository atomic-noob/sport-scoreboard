import { supabase } from './supabaseClient'

/** Registers the service worker (production only) so the app can open offline. */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Offline mode unavailable:', err))
  })
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') navigator.serviceWorker.controller?.postMessage('clear-data')
  })
}
