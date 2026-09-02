import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import type { PublicQuote, Category } from '../../shared/types'
import { CATEGORY_LABEL, CATEGORY_ORDER, UNIT_LABEL } from '../../shared/types'
import { formatCents } from '../../shared/pricing'
import { api, ApiError } from '../lib/api'
import { Button, ErrorNote, LoadingBlock } from '../components/ui'

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

/**
 * The customer-facing quote.
 *
 * This is the only surface a homeowner ever sees, and it has to read as something a real
 * business sent, not as an app screen. Document proportions, generous margins, tabular
 * figures in every money column, and no app chrome beyond the single print action.
 */
export default function PublicQuoteView() {
  const { token = '' } = useParams()
  const [quote, setQuote] = useState<PublicQuote | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setQuote(await api.getPublicQuote(token))
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 404
          ? 'This quote link is no longer valid. Ask your contractor for a new one.'
          : 'Could not load this quote.',
      )
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  if (error) return <ErrorNote message={error} onRetry={() => void load()} />
  if (!quote) return <LoadingBlock label="Loading quote" />

  const { totals, company } = quote
  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    entries: quote.lineItems.filter((i) => i.category === category),
  })).filter((g) => g.entries.length > 0)

  return (
    <div className="min-h-dvh bg-canvas-softer py-0 sm:py-10">
      <article
        className="mx-auto max-w-2xl bg-canvas px-6 py-8 sm:rounded-[var(--radius-xl)] sm:px-12 sm:py-12"
      >
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">{company.name}</h1>
          <div className="mt-1 text-base text-body">
            {company.ownerName && <p>{company.ownerName}</p>}
            {company.address && <p>{company.address}</p>}
            <p className="flex flex-wrap gap-x-3">
              {company.phone && <span>{company.phone}</span>}
              {company.email && <span>{company.email}</span>}
            </p>
          </div>
        </header>

        <div className="mb-8 flex flex-wrap justify-between gap-4 border-y border-canvas-soft py-5">
          <div>
            <p className="text-sm text-body">Quote</p>
            <p className="tabular text-lg font-medium">{quote.quoteNumber}</p>
          </div>
          <div>
            <p className="text-sm text-body">Date</p>
            <p className="text-lg font-medium">{formatDate(quote.createdAt)}</p>
          </div>
          {quote.expiresAt && (
            <div>
              <p className="text-sm text-body">Valid until</p>
              <p className="text-lg font-medium">{formatDate(quote.expiresAt)}</p>
            </div>
          )}
        </div>

        <div className="mb-9">
          <h2 className="text-2xl font-bold">{quote.title}</h2>
          {(quote.customerName || quote.jobAddress) && (
            <p className="mt-1 text-base text-body">
              {[quote.customerName, quote.jobAddress].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {grouped.map(({ category, entries }) => (
          <section key={category} className="mb-8">
            <h3 className="mb-3 border-b border-canvas-soft pb-2 text-sm font-medium tracking-wide text-body">
              {CATEGORY_LABEL[category as Category]}
            </h3>
            <ul className="space-y-3">
              {entries.map((item, i) => (
                <li key={i} className="print-avoid-break flex items-baseline gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-base">{item.name}</p>
                    {item.description && (
                      <p className="mt-0.5 text-sm text-body">{item.description}</p>
                    )}
                    {item.unitType !== 'flat' && (
                      <p className="tabular mt-0.5 text-sm text-body">
                        {item.quantity} {UNIT_LABEL[item.unitType]} at{' '}
                        {formatCents(item.unitPriceCents)}
                      </p>
                    )}
                  </div>
                  <span className="tabular shrink-0 text-base">
                    {formatCents(item.lineTotalCents)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <div className="border-t-2 border-ink pt-5">
          <dl className="space-y-2">
            <Row label="Subtotal" value={formatCents(totals.subtotalCents)} />
            {totals.minimumAdjustmentCents > 0 && (
              <Row
                label="Minimum job charge"
                value={formatCents(totals.minimumAdjustmentCents)}
              />
            )}
            {totals.taxCents > 0 && <Row label="Tax" value={formatCents(totals.taxCents)} />}
            <div className="flex items-baseline justify-between border-t border-canvas-soft pt-3">
              <dt className="text-xl font-bold">Total</dt>
              <dd className="tabular text-3xl font-bold">{formatCents(totals.totalCents)}</dd>
            </div>
          </dl>
        </div>

        {quote.notes && (
          <section className="mt-9">
            <h3 className="mb-2 text-sm font-medium text-body">Notes</h3>
            <p className="text-base whitespace-pre-wrap">{quote.notes}</p>
          </section>
        )}

        {quote.terms && (
          <section className="mt-9 border-t border-canvas-soft pt-5">
            <p className="text-sm leading-relaxed text-body">{quote.terms}</p>
          </section>
        )}

        <div className="no-print mt-10 flex justify-center">
          <Button variant="secondary" onClick={() => window.print()}>
            Save as PDF
          </Button>
        </div>
      </article>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-base text-body">{label}</dt>
      <dd className="tabular text-base">{value}</dd>
    </div>
  )
}
