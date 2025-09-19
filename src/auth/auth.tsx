import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { auth, provider } from '../firebase'
import { signInWithPopup, onAuthStateChanged, User, signOut, getIdToken, signInWithRedirect, getRedirectResult } from 'firebase/auth'

type AuthContextValue = {
  user: User | null
  idToken: string | null
  signInWithGoogle: () => Promise<void>
  refreshToken: () => Promise<string | null>
  logout: () => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [idToken, setIdToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        const token = await getIdToken(u, true)
        setIdToken(token)
      } else {
        setIdToken(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, provider)
    } catch (e: any) {
      // Some browsers or COOP/COEP headers can block popup close; fallback to redirect
      if (e && e.code && String(e.code).includes('popup')) {
        await signInWithRedirect(auth, provider)
      } else {
        throw e
      }
    }
  }, [])

  // Handle redirect results on load (in case popup fallback occurred)
  useEffect(() => {
    getRedirectResult(auth).catch(() => {/* ignore */})
  }, [])

  const refreshToken = useCallback(async () => {
    if (!user) return null
    const token = await getIdToken(user, true)
    setIdToken(token)
    return token
  }, [user])

  const logout = useCallback(async () => {
    await signOut(auth)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, idToken, signInWithGoogle, refreshToken, logout, loading }),
    [user, idToken, signInWithGoogle, refreshToken, logout, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
