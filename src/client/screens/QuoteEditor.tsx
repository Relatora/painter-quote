import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import type {
  QuoteWithItems,
  PriceBookItem,
  QuoteLineItem,
  QuotePhoto,
  Category,
} from '../../shared/types'
import { CATEGORY_LABEL, CATEGORY_ORDER, UNIT_LABEL } from '../../shared/types'
import { calculateTotals, lineTotalCents, formatCents, parsePriceToCents } from '../../shared/pricing'
import { api, photoUrl, ApiError } from '../lib/api'
import { prepareImage } from '../lib/image'
import {
  Button,
  IconButton,
  Field,
  Sheet,
  BackIcon,
  PlusIcon,
  TrashIcon,
  ShareIcon,
  CameraIcon,
  ErrorNote,
  LoadingBlock,
  Spinner,
} from '../components/ui'

/** A line item held in local editor state. Saved as a whole list, so no server id needed. */
type DraftItem = Omit<QuoteLineItem, 'id' | 'quoteId' | 'sortOrder'>

const toDraft = (i: QuoteLineItem): DraftItem => ({
  priceBookItemId: i.priceBookItemId,
  name: i.name,
  description: i.description,
  category: i.category,
  unitType: i.unitType,
  quantity: i.quantity,
  unitPriceCents: i.unitPriceCents,
  isPriceUnconfirmed: i.isPriceUnconfirmed,
})

export default function QuoteEditor() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const [quote, setQuote] = useState<QuoteWithItems | null>(null)
  const [priceBook, setPriceBook] = useState<PriceBookItem[]>([])
  const [items, setItems] = useState<DraftItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [photos, setPhotos] = useState<QuotePhoto[]>([])
  const [uploading, setUploading] = useState(0)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [q, pb] = await Promise.all([api.getQuote(id), api.getPriceBook()])
      setQuote(q)
      setItems(q.lineItems.map(toDraft))
      setPhotos(q.photos)
      setPriceBook(pb)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not open this quote.')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  // --- Debounced autosave of the line item list -----------------------------
  // The painter is mid-conversation with a customer; an explicit Save button is one
  // more thing to forget. Saving trails edits by 700ms instead.
  const saveTimer = useRef<number | undefined>(undefined)
  const dirty = useRef(false)

  const scheduleSave = useCallback(
    (next: DraftItem[]) => {
      dirty.current = true
      window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(async () => {
        setSaving(true)
        try {
          await api.saveItems(id, next)
          dirty.current = false
          setError(null)
        } catch (e) {
          setError(e instanceof ApiError ? e.message : 'Could not save.')
        } finally {
          setSaving(false)
        }
      }, 700)
    },
    [id],
  )

  const updateItems = useCallback(
    (next: DraftItem[]) => {
      setItems(next)
      scheduleSave(next)
    },
    [scheduleSave],
  )

  useEffect(() => () => window.clearTimeout(saveTimer.current), [])

  // --- Quote field edits ----------------------------------------------------
  const fieldTimer = useRef<number | undefined>(undefined)
  const patchQuote = useCallback(
    (patch: Partial<QuoteWithItems>) => {
      setQuote((q) => (q ? { ...q, ...patch } : q))
      window.clearTimeout(fieldTimer.current)
      fieldTimer.current = window.setTimeout(() => {
        void api.updateQuote(id, patch).catch(() => setError('Could not save job details.'))
      }, 700)
    },
    [id],
  )

  const totals = useMemo(
    () =>
      calculateTotals({
        lineItems: items,
        taxRateBps: quote?.taxRateBps ?? 0,
        jobMinimumCents: quote?.jobMinimumCents ?? 0,
      }),
    [items, quote?.taxRateBps, quote?.jobMinimumCents],
  )

  function addFromPriceBook(entry: PriceBookItem) {
    updateItems([
      ...items,
      {
        priceBookItemId: entry.id,
        name: entry.name,
        description: entry.description,
        category: entry.category,
        unitType: entry.unitType,
        quantity: 1,
        unitPriceCents: entry.unitPriceCents,
        // A seeded default is a suggestion, not the painter's price, until confirmed.
        isPriceUnconfirmed: entry.isDefault,
      },
    ])
  }

  function setQuantity(index: number, raw: string) {
    const value = Number.parseFloat(raw)
    const next = [...items]
    next[index] = { ...next[index], quantity: Number.isFinite(value) ? value : 0 }
    updateItems(next)
  }

  /**
   * Editing a price is how the price book fills itself in. The edit confirms the line
   * and writes the number back to the book, so the painter is never asked again.
   */
  function setPrice(index: number, raw: string) {
    const cents = parsePriceToCents(raw)
    const item = items[index]
    const next = [...items]
    next[index] = { ...item, unitPriceCents: cents, isPriceUnconfirmed: false }
    updateItems(next)

    if (item.isPriceUnconfirmed && item.priceBookItemId) {
      void api
        .confirmPrice(item.priceBookItemId, cents)
        .then(setPriceBook)
        .catch(() => {
          /* The line is still correct; the book just keeps its default for now. */
        })
    }
  }

  async function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) return
    const chosen = Array.from(files)
    setUploading((n) => n + chosen.length)

    // Sequential rather than parallel: a phone on a weak connection handles one upload
    // far better than five, and the strip fills in visibly as each lands.
    for (const file of chosen) {
      try {
        const prepared = await prepareImage(file)
        const photo = await api.uploadPhoto(id, prepared.blob, prepared.width, prepared.height)
        setPhotos((current) => [...current, photo])
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not add that photo.')
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  async function removePhoto(photoId: string) {
    setPhotos((current) => current.filter((p) => p.id !== photoId))
    await api.deletePhoto(photoId).catch(() => setError('Could not remove that photo.'))
  }

  function removeItem(index: number) {
    updateItems(items.filter((_, i) => i !== index))
  }

  async function share() {
    if (!quote) return
    const url = `${window.location.origin}/q/${quote.publicToken}`
    const title = `${quote.title}: ${quote.quoteNumber}`
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        /* The painter dismissed the share sheet. Not an error. */
        return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setError(null)
      window.alert('Quote link copied.')
    } catch {
      window.prompt('Copy this quote link:', url)
    }
  }

  async function remove() {
    if (!window.confirm('Delete this quote? This cannot be undone.')) return
    await api.deleteQuote(id).catch(() => undefined)
    navigate('/')
  }

  if (!quote && !error) return <LoadingBlock label="Opening quote" />
  if (!quote)
    return (
      <div className="min-h-dvh bg-canvas pt-safe">
        <ErrorNote message={error ?? 'Not found'} onRetry={() => void load()} />
        <div className="px-4">
          <Link to="/">
            <Button variant="secondary">Back to quotes</Button>
          </Link>
        </div>
      </div>
    )

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    entries: items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.category === category),
  })).filter((g) => g.entries.length > 0)

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="pt-safe sticky top-0 z-20 border-b border-canvas-soft bg-canvas">
        <div className="flex items-center gap-1 px-2 py-2">
          <Link to="/" aria-label="Back to quotes">
            <IconButton label="Back to quotes">
              <BackIcon />
            </IconButton>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-body">{quote.quoteNumber}</p>
          </div>
          {saving && <Spinner className="mr-2 h-4 w-4 text-body" />}
          <IconButton label="Delete quote" onClick={remove}>
            <TrashIcon className="h-5 w-5" />
          </IconButton>
        </div>
      </header>

      {error && <ErrorNote message={error} onRetry={() => void load()} />}

      <section className="space-y-4 px-4 py-5">
        <Field
          label="Job"
          value={quote.title}
          onChange={(v) => patchQuote({ title: v })}
          placeholder="Bathroom repaint"
        />
        <Field
          label="Customer"
          value={quote.customerName ?? ''}
          onChange={(v) => patchQuote({ customerName: v })}
          placeholder="Name"
        />
        <Field
          label="Address"
          value={quote.jobAddress ?? ''}
          onChange={(v) => patchQuote({ jobAddress: v })}
          placeholder="Street, city"
        />
      </section>

      <PhotoStrip
        photos={photos}
        uploading={uploading}
        onAdd={addPhotos}
        onRemove={removePhoto}
      />

      <section>
        <div className="flex items-baseline justify-between px-4 pt-2 pb-3">
          <h2 className="text-xl font-bold">Work</h2>
          {items.length > 0 && (
            <span className="text-sm text-body">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        {items.length === 0 && (
          <p className="px-4 pb-4 text-base text-body">
            Nothing added yet. Pull items from your price book and set the quantities.
          </p>
        )}

        {grouped.map(({ category, entries }) => (
          <div key={category}>
            <h3 className="bg-canvas-softer px-4 py-2 text-sm font-medium tracking-wide text-body">
              {CATEGORY_LABEL[category as Category]}
            </h3>
            <ul className="divide-y divide-canvas-soft">
              {entries.map(({ item, index }) => (
                <LineRow
                  key={`${category}-${index}`}
                  item={item}
                  onQuantity={(v) => setQuantity(index, v)}
                  onPrice={(v) => setPrice(index, v)}
                  onRemove={() => removeItem(index)}
                />
              ))}
            </ul>
          </div>
        ))}

        <div className="px-4 py-4">
          <Button variant="secondary" className="w-full" onClick={() => setSheetOpen(true)}>
            <PlusIcon className="h-5 w-5" />
            Add work
          </Button>
        </div>
      </section>

      <footer
        className="pb-safe sticky bottom-0 z-30 mt-auto border-t border-canvas-soft
          bg-canvas px-4 pt-3"
      >
        {totals.hasUnconfirmedPrices && (
          <p className="mb-2 text-sm text-body">
            Some prices are still our suggestions. Tap each one to set yours.
          </p>
        )}
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-base text-body">
            {totals.taxCents > 0 ? 'Total incl. tax' : 'Total'}
          </span>
          <span className="tabular text-3xl font-bold">{formatCents(totals.totalCents)}</span>
        </div>
        <Button size="lg" className="w-full" onClick={share} disabled={items.length === 0}>
          <ShareIcon className="h-5 w-5" />
          Preview and send
        </Button>
      </footer>

      <PriceBookSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        priceBook={priceBook}
        onPick={addFromPriceBook}
      />
    </div>
  )
}

/* --------------------------------------------------------------------------- */

function PhotoStrip({
  photos,
  uploading,
  onAdd,
  onRemove,
}: {
  photos: QuotePhoto[]
  uploading: number
  onAdd: (files: FileList | null) => void
  onRemove: (id: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <section className="border-t border-canvas-soft py-5">
      <div className="flex items-baseline justify-between px-4 pb-3">
        <h2 className="text-xl font-bold">Photos</h2>
        {photos.length > 0 && (
          <span className="text-sm text-body">
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        /* Opens the rear camera directly on a phone instead of the file browser.
           Desktop browsers ignore it and show a normal picker, which is what we want. */
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          onAdd(e.target.files)
          // Reset so choosing the same file twice still fires a change event.
          e.target.value = ''
        }}
      />

      <div className="flex gap-3 overflow-x-auto px-4 pb-1">
        {photos.map((photo) => (
          <div key={photo.id} className="relative shrink-0">
            <img
              src={photoUrl(photo.id)}
              alt="Job photo"
              loading="lazy"
              className="h-28 w-28 rounded-[var(--radius-lg)] bg-canvas-soft object-cover"
            />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => onRemove(photo.id)}
              className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center
                rounded-[var(--radius-pill)] border-2 border-canvas bg-ink text-on-dark"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        ))}

        {Array.from({ length: uploading }, (_, i) => (
          <div
            key={`pending-${i}`}
            className="flex h-28 w-28 shrink-0 items-center justify-center
              rounded-[var(--radius-lg)] bg-canvas-soft"
          >
            <Spinner className="h-5 w-5 text-body" />
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-28 w-28 shrink-0 flex-col items-center justify-center gap-1.5
            rounded-[var(--radius-lg)] border-2 border-dashed border-mute text-body
            active:bg-canvas-soft"
        >
          <CameraIcon className="h-7 w-7" />
          <span className="text-sm font-medium">Add</span>
        </button>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------------------- */

function LineRow({
  item,
  onQuantity,
  onPrice,
  onRemove,
}: {
  item: DraftItem
  onQuantity: (v: string) => void
  onPrice: (v: string) => void
  onRemove: () => void
}) {
  const [priceText, setPriceText] = useState(() => (item.unitPriceCents / 100).toFixed(2))
  const unit = UNIT_LABEL[item.unitType]

  return (
    <li className="px-4 py-3">
      <div className="mb-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium">{item.name}</p>
          {item.description && <p className="mt-0.5 text-sm text-body">{item.description}</p>}
        </div>
        <span className="tabular shrink-0 text-base font-medium">
          {formatCents(lineTotalCents(item))}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`qty-${item.name}`}>
          Quantity for {item.name}
        </label>
        <input
          id={`qty-${item.name}`}
          inputMode="decimal"
          defaultValue={String(item.quantity)}
          onChange={(e) => onQuantity(e.target.value)}
          className="tabular w-20 rounded-[var(--radius-md)] bg-canvas-soft px-3 py-2.5
            text-base border-2 border-transparent focus:border-ink focus:bg-canvas focus:outline-none"
        />
        {unit && <span className="w-12 text-sm text-body">{unit}</span>}

        <span className="text-body">×</span>

        <div className="relative flex-1">
          <span className="absolute top-1/2 left-3 -translate-y-1/2 text-body">$</span>
          <input
            aria-label={`Unit price for ${item.name}`}
            inputMode="decimal"
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            onBlur={() => onPrice(priceText)}
            className={`tabular w-full rounded-[var(--radius-md)] bg-canvas-soft py-2.5 pr-3 pl-7
              text-base border-2 focus:border-ink focus:bg-canvas focus:outline-none
              ${item.isPriceUnconfirmed ? 'border-dashed border-mute' : 'border-transparent'}`}
          />
        </div>

        <IconButton label={`Remove ${item.name}`} onClick={onRemove}>
          <TrashIcon className="h-5 w-5 text-body" />
        </IconButton>
      </div>

      {item.isPriceUnconfirmed && (
        <p className="mt-1.5 text-sm text-body">Our suggestion: tap to set your price</p>
      )}
    </li>
  )
}

/* --------------------------------------------------------------------------- */

function PriceBookSheet({
  open,
  onClose,
  priceBook,
  onPick,
}: {
  open: boolean
  onClose: () => void
  priceBook: PriceBookItem[]
  onPick: (item: PriceBookItem) => void
}) {
  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    entries: priceBook.filter((i) => i.category === category),
  })).filter((g) => g.entries.length > 0)

  return (
    <Sheet open={open} onClose={onClose} title="Add work">
      {grouped.map(({ category, entries }) => (
        <div key={category}>
          <h3 className="bg-canvas-softer px-4 py-2 text-sm font-medium text-body">
            {CATEGORY_LABEL[category as Category]}
          </h3>
          <ul className="divide-y divide-canvas-soft">
            {entries.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => onPick(entry)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-canvas-soft"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium">{entry.name}</p>
                    {entry.description && (
                      <p className="mt-0.5 text-sm text-body">{entry.description}</p>
                    )}
                  </div>
                  <span className="tabular shrink-0 text-right text-sm text-body">
                    {formatCents(entry.unitPriceCents)}
                    {UNIT_LABEL[entry.unitType] && `/${UNIT_LABEL[entry.unitType]}`}
                  </span>
                  <PlusIcon className="h-5 w-5 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Sheet>
  )
}
