import { describe, it, expect } from 'vitest'
import {
  createSession,
  readSession,
  createLoginToken,
  hashLoginToken,
  normalizeEmail,
  looksLikeEmail,
  sessionCookie,
  clearedCookie,
} from './session'

const SECRET = 'test-secret-value'

describe('session cookies', () => {
  it('round trips a contractor id', async () => {
    const token = await createSession('contractor-1', SECRET)
    expect(await readSession(token, SECRET)).toBe('contractor-1')
  })

  it('rejects a session signed with a different secret', async () => {
    const token = await createSession('contractor-1', SECRET)
    expect(await readSession(token, 'other-secret')).toBeNull()
  })

  it('rejects a tampered payload', async () => {
    // The whole point of signing: editing the contractor id must not grant access to
    // someone else's quotes and price book.
    const token = await createSession('contractor-1', SECRET)
    const [, signature] = token.split('.')
    const forged = btoa(JSON.stringify({ sub: 'contractor-2', exp: 9999999999 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(await readSession(`${forged}.${signature}`, SECRET)).toBeNull()
  })

  it('rejects an expired session', async () => {
    const expired = { sub: 'contractor-1', exp: Math.floor(Date.now() / 1000) - 60 }
    const body = btoa(JSON.stringify(expired))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
    const encoded = btoa(String.fromCharCode(...new Uint8Array(sig)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    // Correctly signed, but past its expiry, so it must still be refused.
    expect(await readSession(`${body}.${encoded}`, SECRET)).toBeNull()
  })

  it('rejects malformed input without throwing', async () => {
    expect(await readSession('', SECRET)).toBeNull()
    expect(await readSession('nodot', SECRET)).toBeNull()
    expect(await readSession('a.b', SECRET)).toBeNull()
    expect(await readSession('...', SECRET)).toBeNull()
  })

  it('produces a cookie value safe to send', async () => {
    const token = await createSession('contractor-1', SECRET)
    // A cookie value may not contain these, so base64url encoding matters.
    expect(token).not.toMatch(/[+/=;,\s]/)
  })
})

describe('cookie attributes', () => {
  it('always sets HttpOnly and SameSite', () => {
    const cookie = sessionCookie('abc', true)
    expect(cookie).toContain('HttpOnly')
    // Lax rather than Strict, so following the magic link from a mail client still
    // arrives with the cookie attached.
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Secure')
  })

  it('omits Secure when not on https, so local development works', () => {
    expect(sessionCookie('abc', false)).not.toContain('Secure')
  })

  it('expires the cookie when clearing', () => {
    expect(clearedCookie(true)).toContain('Max-Age=0')
  })
})

describe('login tokens', () => {
  it('generates distinct high entropy tokens', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => createLoginToken()))
    expect(tokens.size).toBe(200)
    // 32 bytes base64url encodes to 43 characters.
    expect(createLoginToken()).toHaveLength(43)
  })

  it('hashes deterministically', async () => {
    const token = createLoginToken()
    expect(await hashLoginToken(token)).toBe(await hashLoginToken(token))
  })

  it('produces a hash that does not reveal the token', async () => {
    const token = createLoginToken()
    const hash = await hashLoginToken(token)
    expect(hash).not.toContain(token)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('gives different tokens different hashes', async () => {
    expect(await hashLoginToken('a')).not.toBe(await hashLoginToken('b'))
  })
})

describe('email handling', () => {
  it('normalises case and surrounding space', () => {
    expect(normalizeEmail('  Marcus@Example.COM ')).toBe('marcus@example.com')
  })

  it('accepts ordinary addresses', () => {
    expect(looksLikeEmail('marcus@riversidepainting.com')).toBe(true)
    expect(looksLikeEmail('a+tag@sub.domain.co.uk')).toBe(true)
  })

  it('rejects obvious non addresses', () => {
    expect(looksLikeEmail('marcus')).toBe(false)
    expect(looksLikeEmail('marcus@')).toBe(false)
    expect(looksLikeEmail('marcus@localhost')).toBe(false)
    expect(looksLikeEmail('a b@c.com')).toBe(false)
    expect(looksLikeEmail(`${'a'.repeat(250)}@b.com`)).toBe(false)
  })
})
