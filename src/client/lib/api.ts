import type {
  Contractor,
  PriceBookItem,
  Quote,
  QuoteSummary,
  QuoteWithItems,
  QuotePhoto,
  ScopeAnalysis,
  PublicQuote,
} from '../../shared/types'

export class ApiError extends Error {
  // Declared explicitly rather than as a constructor parameter property, which
  // erasableSyntaxOnly disallows: it would need emitted code to assign the field.
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    // A painter in a basement or a dead zone gets this. Say what happened and what to do.
    throw new ApiError('No connection. Your work is saved on this device.', 0)
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status)
  }

  return res.json() as Promise<T>
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
})

/** Photos are served straight from the Worker, so this is just a path. */
export const photoUrl = (id: string) => `/api/photos/${id}`

export const api = {
  getContractor: () => request<Contractor>('/api/contractor'),

  updateContractor: (patch: Partial<Contractor>) =>
    request<Contractor>('/api/contractor', json('PATCH', patch)),

  getPriceBook: () => request<PriceBookItem[]>('/api/pricebook'),

  confirmPrice: (id: string, unitPriceCents: number) =>
    request<PriceBookItem[]>(`/api/pricebook/${id}`, json('PATCH', { unitPriceCents })),

  listQuotes: () => request<QuoteSummary[]>('/api/quotes'),

  createQuote: (title: string) => request<QuoteWithItems>('/api/quotes', json('POST', { title })),

  getQuote: (id: string) => request<QuoteWithItems>(`/api/quotes/${id}`),

  updateQuote: (id: string, patch: Partial<Quote>) =>
    request<QuoteWithItems>(`/api/quotes/${id}`, json('PATCH', patch)),

  deleteQuote: (id: string) => request<{ ok: true }>(`/api/quotes/${id}`, { method: 'DELETE' }),

  saveItems: (id: string, items: unknown[]) =>
    request<QuoteWithItems>(`/api/quotes/${id}/items`, json('PUT', { items })),

  getPublicQuote: (token: string) => request<PublicQuote>(`/api/public/${token}`),

  /**
   * Posts the prepared image bytes directly. Deliberately bypasses `request`, whose
   * JSON content-type header would misdescribe the body: the server reads the
   * content-type to decide the R2 object type and reject anything that is not an image.
   */
  uploadPhoto: async (
    quoteId: string,
    blob: Blob,
    width: number,
    height: number,
  ): Promise<QuotePhoto> => {
    let res: Response
    try {
      res = await fetch(`/api/quotes/${quoteId}/photos?w=${width}&h=${height}`, {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'image/jpeg' },
        body: blob,
      })
    } catch {
      throw new ApiError('No connection. The photo was not uploaded.', 0)
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      throw new ApiError(body?.error ?? 'Could not upload that photo.', res.status)
    }
    return res.json() as Promise<QuotePhoto>
  },

  deletePhoto: (id: string) => request<{ ok: true }>(`/api/photos/${id}`, { method: 'DELETE' }),

  analyzeQuote: (id: string) =>
    request<ScopeAnalysis>(`/api/quotes/${id}/analyze`, { method: 'POST' }),

  saveRooms: (id: string, rooms: unknown[]) =>
    request<QuoteWithItems>(`/api/quotes/${id}/rooms`, json('PUT', { rooms })),

  me: () => request<AuthState>('/api/auth/me'),

  requestSignIn: (email: string) =>
    request<{ sent: true; devLink?: string }>('/api/auth/request', json('POST', { email })),

  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
}

export interface AuthState {
  signedIn: boolean
  /** True when running on the shared demo account rather than a real sign-in. */
  demo?: boolean
  contractor?: Contractor
}
