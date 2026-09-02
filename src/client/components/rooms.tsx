import { useState, useId } from 'react'
import type { QuoteRoom } from '../../shared/types'
import { roomFromDimensions, totalsForRooms } from '../../shared/rooms'
import { ROOM_PRESETS } from '../../shared/room-presets'
import {
  Button,
  IconButton,
  Sheet,
  PlusIcon,
  TrashIcon,
  ChevronIcon,
  RulerIcon,
} from './ui'

/** Two coats is the residential default, so a freshly added room starts there. */
const DEFAULT_COATS = 2

const newRoom = (
  name: string,
  surfaces: { wallSqft: number; ceilingSqft: number; trimLinft: number },
): QuoteRoom => ({
  id: crypto.randomUUID(),
  quoteId: '',
  name,
  ...surfaces,
  coats: DEFAULT_COATS,
  sortOrder: 0,
  createdAt: '',
})

export function MeasurementSummary({
  rooms,
  onOpen,
}: {
  rooms: QuoteRoom[]
  onOpen: () => void
}) {
  const totals = totalsForRooms(rooms)

  return (
    <section className="border-t border-canvas-soft px-4 py-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Measurements</h2>
        {rooms.length > 0 && (
          <span className="text-sm text-body">
            {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}
          </span>
        )}
      </div>

      {rooms.length === 0 ? (
        <>
          <Button variant="secondary" className="w-full" onClick={onOpen}>
            <RulerIcon className="h-5 w-5" />
            Add rooms
          </Button>
          <p className="mt-2 text-sm text-body">
            Pick a room size and the quantities fill themselves in.
          </p>
        </>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] bg-canvas-soft
            px-4 py-3.5 text-left active:bg-surface-pressed"
        >
          <span className="tabular min-w-0 flex-1 text-base">
            {totals.wallSqft} sq ft walls, {totals.ceilingSqft} sq ft ceiling,{' '}
            {totals.trimLinft} lin ft trim
          </span>
          <ChevronIcon className="h-5 w-5 shrink-0 text-body" />
        </button>
      )}
    </section>
  )
}

export function RoomsSheet({
  open,
  rooms,
  onClose,
  onChange,
  onApply,
}: {
  open: boolean
  rooms: QuoteRoom[]
  onClose: () => void
  onChange: (rooms: QuoteRoom[]) => void
  onApply: (rooms: QuoteRoom[]) => void
}) {
  const [custom, setCustom] = useState({
    length: '',
    width: '',
    height: '8',
    doors: '1',
    windows: '1',
  })

  function addPreset(preset: (typeof ROOM_PRESETS)[number]) {
    onChange([
      ...rooms,
      newRoom(preset.name, {
        wallSqft: preset.wallSqft,
        ceilingSqft: preset.ceilingSqft,
        trimLinft: preset.trimLinft,
      }),
    ])
  }

  function addCustom() {
    const surfaces = roomFromDimensions({
      lengthFt: Number.parseFloat(custom.length),
      widthFt: Number.parseFloat(custom.width),
      heightFt: Number.parseFloat(custom.height),
      doors: Number.parseInt(custom.doors, 10),
      windows: Number.parseInt(custom.windows, 10),
    })
    // Nothing measurable was entered. Silently doing nothing is better than adding a
    // zero room that quietly contributes nothing to the quantities.
    if (surfaces.wallSqft === 0 && surfaces.ceilingSqft === 0) return

    onChange([...rooms, newRoom(`${custom.length} by ${custom.width}`, surfaces)])
    setCustom((c) => ({ ...c, length: '', width: '' }))
  }

  function setCoats(id: string, coats: number) {
    onChange(rooms.map((r) => (r.id === id ? { ...r, coats } : r)))
  }

  return (
    <Sheet open={open} onClose={onClose} title="Measurements">
      {rooms.length > 0 && (
        <ul className="divide-y divide-canvas-soft">
          {rooms.map((room) => (
            <li key={room.id} className="px-4 py-3">
              <div className="mb-2 flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium">{room.name}</p>
                  <p className="tabular mt-0.5 text-sm text-body">
                    {room.wallSqft} sq ft walls, {room.ceilingSqft} ceiling,{' '}
                    {room.trimLinft} lin ft trim
                  </p>
                </div>
                <IconButton
                  label={`Remove ${room.name}`}
                  onClick={() => onChange(rooms.filter((r) => r.id !== room.id))}
                >
                  <TrashIcon className="h-5 w-5 text-body" />
                </IconButton>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-body">Coats</span>
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={room.coats === n}
                    onClick={() => setCoats(room.id, n)}
                    className={`tabular h-11 w-11 rounded-[var(--radius-pill)] text-base font-medium
                      ${room.coats === n ? 'bg-ink text-on-dark' : 'bg-canvas-soft text-ink'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3 className="bg-canvas-softer px-4 py-2 text-sm font-medium text-body">Common rooms</h3>
      <div className="flex flex-wrap gap-2 px-4 py-3">
        {ROOM_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => addPreset(preset)}
            className="min-h-11 rounded-[var(--radius-pill)] bg-canvas-soft px-4 text-base
              font-medium active:bg-surface-pressed"
          >
            {preset.name}
          </button>
        ))}
      </div>

      <h3 className="bg-canvas-softer px-4 py-2 text-sm font-medium text-body">Measure a room</h3>
      <div className="px-4 py-3">
        <div className="mb-3 grid grid-cols-3 gap-2">
          <NumberBox
            label="Length"
            value={custom.length}
            onChange={(v) => setCustom({ ...custom, length: v })}
          />
          <NumberBox
            label="Width"
            value={custom.width}
            onChange={(v) => setCustom({ ...custom, width: v })}
          />
          <NumberBox
            label="Height"
            value={custom.height}
            onChange={(v) => setCustom({ ...custom, height: v })}
          />
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <NumberBox
            label="Doors"
            value={custom.doors}
            onChange={(v) => setCustom({ ...custom, doors: v })}
          />
          <NumberBox
            label="Windows"
            value={custom.windows}
            onChange={(v) => setCustom({ ...custom, windows: v })}
          />
        </div>
        <Button variant="secondary" className="w-full" onClick={addCustom}>
          <PlusIcon className="h-5 w-5" />
          Add this room
        </Button>
      </div>

      <div className="pb-safe sticky bottom-0 border-t border-canvas-soft bg-canvas px-4 py-3">
        <Button
          size="lg"
          className="w-full"
          onClick={() => onApply(rooms)}
          disabled={rooms.length === 0}
        >
          Use these measurements
        </Button>
        <p className="mt-2 text-sm text-body">
          Fills quantities on wall, ceiling, and trim work. Doors, windows, and fees keep
          the counts you set.
        </p>
      </div>
    </Sheet>
  )
}

function NumberBox({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm text-body">
        {label}
      </label>
      <input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="tabular w-full rounded-[var(--radius-md)] border-2 border-transparent
          bg-canvas-soft px-3 py-2.5 text-base focus:border-ink focus:bg-canvas focus:outline-none"
      />
    </div>
  )
}
