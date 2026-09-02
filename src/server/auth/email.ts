export interface EmailSender {
  sendMagicLink(to: string, link: string): Promise<void>
  /** True when nothing was actually delivered, so the caller can surface the link instead. */
  readonly isStub: boolean
}

export interface EmailEnv {
  DEMO_MODE: string
  RESEND_API_KEY?: string
  MAIL_FROM?: string
}

/**
 * Resend's free tier covers 3,000 emails a month, which is far beyond what a pilot needs
 * and costs nothing. Falls back to a stub whenever no key is configured, so sign-in works
 * locally and during a demo without an email account existing at all.
 */
export function getEmailSender(env: EmailEnv): EmailSender {
  if (!env.RESEND_API_KEY) return stubSender()
  return resendSender(env.RESEND_API_KEY, env.MAIL_FROM || 'onboarding@resend.dev')
}

function resendSender(apiKey: string, from: string): EmailSender {
  return {
    isStub: false,
    async sendMagicLink(to, link) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to,
          subject: 'Your sign-in link',
          text: signInText(link),
          html: signInHtml(link),
        }),
      })

      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(`Resend rejected the message (${res.status}): ${detail.slice(0, 300)}`)
      }
    },
  }
}

function stubSender(): EmailSender {
  return {
    isStub: true,
    async sendMagicLink(to, link) {
      // Never log the link in a deployed environment. The route only surfaces it when
      // DEMO_MODE is on, and this line exists for local development.
      console.log(`[auth] magic link for ${to}: ${link}`)
    },
  }
}

const signInText = (link: string) =>
  `Tap this link to sign in:\n\n${link}\n\nIt works once and expires in 15 minutes. If you did not ask to sign in, you can ignore this.`

/**
 * Deliberately plain. Mail clients strip most CSS, and a painter checking mail on a phone
 * between jobs wants one obvious link, not a designed template.
 */
const signInHtml = (link: string) => `<!doctype html>
<html>
  <body style="margin:0;padding:24px;font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif;color:#000;background:#fff;">
    <p style="font-size:16px;line-height:24px;margin:0 0 20px;">Tap the button to sign in.</p>
    <p style="margin:0 0 24px;">
      <a href="${link}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:16px;font-weight:500;">Sign in</a>
    </p>
    <p style="font-size:14px;line-height:20px;color:#5e5e5e;margin:0;">
      It works once and expires in 15 minutes. If you did not ask to sign in, you can ignore this.
    </p>
  </body>
</html>`
