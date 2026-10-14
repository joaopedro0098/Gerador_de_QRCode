import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let settled = false
    const finish = (nextSession) => {
      if (settled) return
      settled = true
      setSession(nextSession)
      setLoading(false)
    }

    const watchdog = window.setTimeout(() => finish(null), 8000)

    supabase.auth
      .getSession()
      .then(({ data }) => {
        window.clearTimeout(watchdog)
        finish(data.session)
      })
      .catch(() => {
        window.clearTimeout(watchdog)
        finish(null)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.clearTimeout(watchdog)
      finish(nextSession)
    })

    return () => {
      window.clearTimeout(watchdog)
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      session,
      loading,
      signIn: (email, password) =>
        supabase.auth.signInWithPassword({ email, password }),
      signOut: () => supabase.auth.signOut(),
    }),
    [session, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
