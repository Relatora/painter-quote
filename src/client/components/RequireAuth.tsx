import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { api, type AuthState } from '../lib/api'
import { LoadingBlock } from './ui'

/**
 * Gates the contractor-facing screens.
 *
 * While DEMO_MODE is on the server resolves a shared demo contractor, so this passes
 * without a sign-in and the validation demo stays frictionless. With DEMO_MODE off the
 * same check sends an unauthenticated painter to the sign-in screen.
 *
 * The customer-facing quote route is deliberately outside this: a homeowner opening a
 * link must never be asked to sign in.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    api
      .me()
      .then(setAuth)
      .catch(() => setFailed(true))
  }, [])

  if (failed) return <Navigate to="/signin" replace />
  if (!auth) return <LoadingBlock label="Loading" />
  if (!auth.signedIn) return <Navigate to="/signin" replace />

  return <>{children}</>
}
