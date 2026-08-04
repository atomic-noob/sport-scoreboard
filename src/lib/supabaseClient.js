import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const hasRealCredentials = Boolean(supabaseUrl && supabaseAnonKey)

if (!hasRealCredentials) {
  console.warn(
    'Supabase env vars missing. Copy .env.example to .env and fill in your project URL + anon key. ' +
      'The app will still run using local storage only until then -- any Supabase calls will simply fail silently.'
  )
}

// createClient() requires a validly-formatted URL even if we never
// actually reach it. Falling back to a placeholder here means the app
// doesn't crash on startup before Supabase is wired up -- it just won't
// be able to sync until real credentials are added to .env.
export const supabase = createClient(
  hasRealCredentials ? supabaseUrl : 'https://placeholder.supabase.co',
  hasRealCredentials ? supabaseAnonKey : 'placeholder-anon-key'
)

export const supabaseConfigured = hasRealCredentials
