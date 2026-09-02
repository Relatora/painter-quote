import { useEffect, useId, useRef, type ReactNode } from 'react'

/* ---------------------------------------------------------------------------
   Icons. Authored SVG on a 24px grid at a uniform 2px stroke: never emoji or
   unicode glyphs standing in for an icon system.
   --------------------------------------------------------------------------- */

type IconProps = { className?: string }

const icon = (path: ReactNode) =>
  function Icon({ className = 'w-6 h-6' }: IconProps) {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {path}
      </svg>
    )
  }

export const PlusIcon = icon(<path d="M12 5v14M5 12h14" />)
export const BackIcon = icon(<path d="M15 18l-6-6 6-6" />)
export const ChevronIcon = icon(<path d="M9 18l6-6-6-6" />)
export const TrashIcon = icon(
  <>
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    <path d="M10 11v5M14 11v5" />
  </>,
)
export const SettingsIcon = icon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.9 14.6a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" />
  </>,
)
export const ShareIcon = icon(
  <>
    <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" />
    <path d="M16 6l-4-4-4 4M12 2v14" />
  </>,
)
export const CheckIcon = icon(<path d="M20 6L9 17l-5-5" />)
export const AlertIcon = icon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v5M12 16.5v.01" />
  </>,
)
export const BrushIcon = icon(
  <>
    <path d="M4 20s1-3 4-3 3 2 5 2 4-2 4-2" />
    <path d="M9 14l7.5-9a2.1 2.1 0 013 3L11 15" />
  </>,
)

/* ---------------------------------------------------------------------------
   Controls
   --------------------------------------------------------------------------- */

type ButtonProps = {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'lg' | 'md' | 'sm'
  type?: 'button' | 'submit'
  disabled?: boolean
  busy?: boolean
  className?: string
}

/**
 * Primary sits at 56px, above the 44px floor. The user may have paint on their hands and
 * be standing in a customer's hallway; a comfortable target is not a luxury here.
 */
const SIZES = {
  lg: 'min-h-14 px-7 text-lg',
  md: 'min-h-12 px-5 text-base',
  sm: 'min-h-11 px-4 text-sm',
} as const

const VARIANTS = {
  primary: 'bg-ink text-on-dark active:bg-black-elevated disabled:bg-mute',
  secondary:
    'bg-canvas text-ink border-2 border-ink active:bg-surface-pressed disabled:border-mute disabled:text-mute',
  ghost: 'bg-transparent text-ink active:bg-canvas-soft disabled:text-mute',
  danger: 'bg-canvas text-alert border-2 border-alert active:bg-surface-pressed',
} as const

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled,
  busy,
  className = '',
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)]
        font-medium transition-colors select-none disabled:cursor-not-allowed
        ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
    >
      {busy && <Spinner />}
      {children}
    </button>
  )
}

export function IconButton({
  children,
  onClick,
  label,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center
        rounded-[var(--radius-pill)] text-ink transition-colors active:bg-canvas-soft ${className}`}
    >
      {children}
    </button>
  )
}

export function Spinner({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
        fill="none"
      />
      <path
        d="M21 12a9 9 0 00-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

/* ---------------------------------------------------------------------------
   Fields
   --------------------------------------------------------------------------- */

const FIELD_CLASS = `w-full rounded-[var(--radius-md)] bg-canvas-soft px-4 py-3.5
  text-base text-ink placeholder:text-mute border-2 border-transparent
  focus:border-ink focus:bg-canvas focus:outline-none`

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
  hint,
  multiline,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  inputMode?: 'text' | 'decimal' | 'numeric' | 'tel' | 'email'
  hint?: string
  multiline?: boolean
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-body">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          rows={3}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${FIELD_CLASS} resize-y`}
        />
      ) : (
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={FIELD_CLASS}
        />
      )}
      {hint && <p className="mt-1.5 text-sm text-body">{hint}</p>}
    </div>
  )
}

/* ---------------------------------------------------------------------------
   Bottom sheet
   --------------------------------------------------------------------------- */

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Stop the page behind the sheet scrolling with it.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="pb-safe relative max-h-[85vh] overflow-y-auto
          rounded-t-[var(--radius-xl)] bg-canvas focus:outline-none"
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between
            border-b border-canvas-soft bg-canvas px-4 py-3"
        >
          <h2 className="text-xl font-bold">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
   States
   --------------------------------------------------------------------------- */

export function EmptyState({
  icon: Glyph,
  title,
  body,
  action,
}: {
  icon: (p: IconProps) => ReactNode
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto mb-5 flex justify-center text-mute">
        <Glyph className="h-12 w-12" />
      </div>
      <h2 className="mb-2 text-2xl font-bold">{title}</h2>
      <p className="mx-auto mb-7 max-w-sm text-base text-body">{body}</p>
      {action}
    </div>
  )
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="mx-4 my-4 flex items-start gap-3 rounded-[var(--radius-lg)]
        border border-alert px-4 py-3"
    >
      <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-alert" />
      <div className="flex-1">
        <p className="text-base text-ink">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 text-base font-medium underline underline-offset-4"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  )
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-3 px-6 py-20 text-body">
      <Spinner className="h-5 w-5" />
      <span className="text-base">{label}</span>
    </div>
  )
}
