import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { Contractor } from '../../shared/types'
import { parsePriceToCents, formatCents } from '../../shared/pricing'
import { api, ApiError, type AuthState } from '../lib/api'
import { Button, IconButton, Field, BackIcon, ErrorNote, LoadingBlock } from '../components/ui'

export default function Settings() {
  const [contractor, setContractor] = useState<Contractor | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [auth, setAuth] = useState<AuthState | null>(null)

  // Held as text so a half typed value like "8." does not get coerced mid keystroke.
  const [taxText, setTaxText] = useState('')
  const [minimumText, setMinimumText] = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      const [c, me] = await Promise.all([api.getContractor(), api.me()])
      setContractor(c)
      setAuth(me)
      setTaxText((c.taxRateBps / 100).toString())
      setMinimumText((c.jobMinimumCents / 100).toFixed(2))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load settings.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function set(patch: Partial<Contractor>) {
    setContractor((c) => (c ? { ...c, ...patch } : c))
    setSaved(false)
  }

  async function save() {
    if (!contractor) return
    setSaving(true)
    setError(null)
    try {
      const taxPercent = Number.parseFloat(taxText)
      const updated = await api.updateContractor({
        companyName: contractor.companyName,
        ownerName: contractor.ownerName,
        email: contractor.email,
        phone: contractor.phone,
        address: contractor.address,
        quoteTerms: contractor.quoteTerms,
        // Percent in, basis points out. 8.25 becomes 825.
        taxRateBps: Number.isFinite(taxPercent) ? Math.round(taxPercent * 100) : 0,
        jobMinimumCents: parsePriceToCents(minimumText),
      })
      setContractor(updated)
      setSaved(true)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  if (!contractor && !error) return <LoadingBlock label="Loading settings" />

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="pt-safe sticky top-0 z-20 border-b border-canvas-soft bg-canvas">
        <div className="flex items-center gap-1 px-2 py-2">
          <Link to="/" aria-label="Back to quotes">
            <IconButton label="Back to quotes">
              <BackIcon />
            </IconButton>
          </Link>
          <h1 className="text-xl font-bold">Your business</h1>
        </div>
      </header>

      {error && <ErrorNote message={error} onRetry={() => void load()} />}

      {contractor && (
        <>
          <section className="space-y-4 px-4 py-5">
            <Field
              label="Company name"
              value={contractor.companyName}
              onChange={(v) => set({ companyName: v })}
              placeholder="Riverside Painting"
              hint="This appears at the top of every quote you send."
            />
            <Field
              label="Your name"
              value={contractor.ownerName ?? ''}
              onChange={(v) => set({ ownerName: v })}
              placeholder="Full name"
            />
            <Field
              label="Phone"
              value={contractor.phone ?? ''}
              onChange={(v) => set({ phone: v })}
              inputMode="tel"
              placeholder="(555) 123-4567"
            />
            <Field
              label="Email"
              value={contractor.email ?? ''}
              onChange={(v) => set({ email: v })}
              inputMode="email"
              placeholder="you@example.com"
            />
            <Field
              label="Business address"
              value={contractor.address ?? ''}
              onChange={(v) => set({ address: v })}
              placeholder="Street, city, state"
            />
          </section>

          <section className="space-y-4 border-t border-canvas-soft px-4 py-5">
            <h2 className="text-xl font-bold">Pricing</h2>
            <Field
              label="Sales tax rate"
              value={taxText}
              onChange={(v) => {
                setTaxText(v)
                setSaved(false)
              }}
              inputMode="decimal"
              placeholder="8.25"
              hint="A percentage. Leave at 0 if you do not charge tax on labor."
            />
            <Field
              label="Minimum job charge"
              value={minimumText}
              onChange={(v) => {
                setMinimumText(v)
                setSaved(false)
              }}
              inputMode="decimal"
              placeholder="250.00"
              hint={
                contractor.jobMinimumCents > 0
                  ? `Quotes below ${formatCents(contractor.jobMinimumCents)} are topped up to it.`
                  : 'Small jobs will not be topped up while this is 0.'
              }
            />
          </section>

          <section className="space-y-4 border-t border-canvas-soft px-4 py-5">
            <h2 className="text-xl font-bold">Terms</h2>
            <Field
              label="Terms shown on every quote"
              value={contractor.quoteTerms ?? ''}
              onChange={(v) => set({ quoteTerms: v })}
              multiline
              hint="Keep the estimate language. It protects you if site conditions differ from the photos."
            />
          </section>

          <section className="border-t border-canvas-soft px-4 py-5">
            <h2 className="mb-3 text-xl font-bold">Account</h2>
            {auth?.demo ? (
              <>
                <p className="mb-4 text-base text-body">
                  You are on the shared demo account. Sign in with your email to keep your
                  own quotes and price book.
                </p>
                <Link to="/signin">
                  <Button variant="secondary" className="w-full">
                    Sign in
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <p className="mb-4 text-base text-body">
                  Signed in as {contractor.email ?? 'your account'}.
                </p>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={async () => {
                    await api.logout().catch(() => undefined)
                    window.location.href = '/signin'
                  }}
                >
                  Sign out
                </Button>
              </>
            )}
          </section>

          <div className="pb-safe sticky bottom-0 mt-auto border-t border-canvas-soft bg-canvas px-4 pt-3">
            <Button size="lg" className="w-full" onClick={save} busy={saving}>
              {saved ? 'Saved' : 'Save'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
