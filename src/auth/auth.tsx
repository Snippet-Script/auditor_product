import React, { createContext, useContext, useMemo, useState } from 'react'

type AuthContextValue = {
  idToken: string | null
  login: (token: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [idToken, setIdToken] = useState<string | null>(null)

  const value = useMemo<AuthContextValue>(
    () => ({ idToken, login: setIdToken, logout: () => setIdToken(null) }),
    [idToken]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
