import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext({ user: null, loading: true })

/** The signed-in user as last saved by Supabase in this browser (used only while offline). */
function storedUser() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && /^sb-.*-auth-token$/.test(key)) {
        return JSON.parse(localStorage.getItem(key))?.user ?? null
      }
    }
  } catch {
    // ignore
  }
  return null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    function load() {
      supabase.auth.getSession().then(({ data }) => {
        // Offline with an expired token the session cannot be refreshed yet. The person is still
        // signed in, so keep showing their pages; saves wait in the queue until the connection returns.
        setUser(data.session?.user ?? (!navigator.onLine ? storedUser() : null))
        setLoading(false)
      })
    }
    load()
    window.addEventListener('online', load)

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      window.removeEventListener('online', load)
      listener.subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
