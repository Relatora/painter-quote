import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { Button, Field, BrushIcon, ErrorNote } from '../components/ui'

/**
 * Magic link sign-in. No password, so there is nothing to choose, forget, or reset.
 *
 * A painter checks email on the same phone they are holding, which makes the link the
 * shortest path in rather than a compromise.
 */
export default function SignIn() {
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [devLink, setDevLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(
    params.get('error') === 'link'
      ? 'That sign-in link has expired or was already used. Request a new one.'
      : null,
  )

  async function submit() {
    setSending(true)
    setError(null)
    try {
      const result = await api.requestSignIn(email)
      setSent(true)
      setDevLink(result.devLink ?? null)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send the link.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="pt-safe flex min-h-dvh flex-col justify-center bg-canvas px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <BrushIcon className="mb-5 h-10 w-10" />
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Painter Quote</h1>
        <p className="mb-8 text-base text-body">
          Photos and a description to a professional quote in under a minute.
        </p>

        {error && <ErrorNote message={error} />}

        {sent ? (
          <>
            <h2 className="mb-2 text-xl font-bold">Check your email</h2>
            <p className="mb-6 text-base text-body">
              We sent a sign-in link to {email}. It works once and expires in 15 minutes.
            </p>

            {devLink && (
              <div className="mb-6 rounded-[var(--radius-lg)] bg-canvas-soft px-4 py-3">
                <p className="mb-2 text-sm text-body">
                  Demo mode: no email provider is configured, so the link is here instead.
                </p>
                <a href={devLink} className="text-base font-medium text-link underline">
                  Open the sign-in link
                </a>
              </div>
            )}

            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setSent(false)
                setDevLink(null)
              }}
            >
              Use a different email
            </Button>
          </>
        ) : (
          <>
            <div className="mb-5">
              <Field
                label="Email"
                value={email}
                onChange={setEmail}
                type="email"
                inputMode="email"
                placeholder="you@example.com"
                hint="We send a link. There is no password to remember."
              />
            </div>
            <Button
              size="lg"
              className="w-full"
              onClick={submit}
              busy={sending}
              disabled={email.trim().length === 0}
            >
              Send me a link
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
