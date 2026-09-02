import { useEffect, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import type { QuoteSummary, Quote, Contractor } from '../../shared/types'
import { formatCents } from '../../shared/pricing'
import { api, ApiError } from '../lib/api'
import {
  Button,
  IconButton,
  SettingsIcon,
  PlusIcon,
  BrushIcon,
  EmptyState,
  ErrorNote,
  LoadingBlock,
} from '../components/ui'

const STATUS_LABEL: Record<Quote['status'], string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  declined: 'Declined',
}

export default function QuoteList() {
  const navigate = useNavigate()
  const [quotes, setQuotes] = useState<QuoteSummary[] | null>(null)
  const [contractor, setContractor] = useState<Contractor | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [q, c] = await Promise.all([api.listQuotes(), api.getContractor()])
      setQuotes(q)
      setContractor(c)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function newQuote() {
    setCreating(true)
    try {
      const quote = await api.createQuote('New job')
      navigate(`/quote/${quote.id}`)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not start a quote.')
      setCreating(false)
    }
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="pt-safe sticky top-0 z-20 border-b border-canvas-soft bg-canvas">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">
              {contractor?.companyName ?? 'Quotes'}
            </h1>
          </div>
          <Link to="/settings" aria-label="Settings">
            <IconButton label="Settings">
              <SettingsIcon />
            </IconButton>
          </Link>
        </div>
      </header>

      {error && <ErrorNote message={error} onRetry={() => void load()} />}

      {quotes === null && !error && <LoadingBlock label="Loading your quotes" />}

      {quotes !== null && quotes.length === 0 && (
        <EmptyState
          icon={BrushIcon}
          title="No quotes yet"
          body="Start one and it takes about a minute. Your prices are already loaded: adjust them as you go."
          action={
            <Button size="lg" onClick={newQuote} busy={creating}>
              <PlusIcon className="h-5 w-5" />
              Start a quote
            </Button>
          }
        />
      )}

      {quotes !== null && quotes.length > 0 && (
        <ul className="divide-y divide-canvas-soft">
          {quotes.map((q) => (
            <li key={q.id}>
              <Link
                to={`/quote/${q.id}`}
                className="flex items-center gap-3 px-4 py-4 active:bg-canvas-soft"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-medium">{q.title}</p>
                  <p className="truncate text-sm text-body">
                    {q.customerName || 'No customer yet'} · {q.quoteNumber} ·{' '}
                    {STATUS_LABEL[q.status]}
                  </p>
                </div>
                <span className="tabular shrink-0 text-lg font-medium">
                  {formatCents(q.totalCents)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {quotes !== null && quotes.length > 0 && (
        <div className="pb-safe sticky bottom-0 border-t border-canvas-soft bg-canvas px-4 py-3">
          <Button size="lg" className="w-full" onClick={newQuote} busy={creating}>
            <PlusIcon className="h-5 w-5" />
            New quote
          </Button>
        </div>
      )}
    </div>
  )
}
