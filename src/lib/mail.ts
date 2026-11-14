const RESEND_URL = 'https://api.resend.com/emails'

export function mailFrom() {
  return process.env.MAIL_FROM || 'Xpend <onboarding@resend.dev>'
}

export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY)
}

export async function sendMail(input: { to: string; subject: string; html: string; text: string }) {
  const key = process.env.RESEND_API_KEY
  if (!key) return { sent: false as const, reason: 'missing_key' as const }

  const response = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: mailFrom(),
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const message = body?.message || body?.error || 'Resend rechazó el envío'
    return { sent: false as const, reason: 'rejected' as const, message: String(message) }
  }

  return { sent: true as const }
}

export function accessEmail(input: { title: string; intro: string; link: string }) {
  const text = `${input.intro}\n\n${input.link}\n`
  const html = `
    <div style="font-family: sans-serif; color: #2D3E3D; line-height: 1.5;">
      <p style="font-size: 18px; margin: 0 0 12px;">${input.title}</p>
      <p style="margin: 0 0 16px;">${input.intro}</p>
      <p style="margin: 0 0 16px;">
        <a href="${input.link}" style="background: #3BE7AE; color: #2D3E3D; text-decoration: none; padding: 10px 16px; border-radius: 10px; display: inline-block;">
          Abrir Xpend
        </a>
      </p>
      <p style="font-size: 12px; color: #5c6b6a;">Si el botón no abre, copia este enlace:<br>${input.link}</p>
    </div>
  `
  return { text, html }
}
