import nodemailer from 'nodemailer'

interface MailOptions {
  to: string
  subject: string
  html: string
}

function createTransporter() {
  if (!process.env.SMTP_HOST) return null
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  })
}

export async function sendEmail(opts: MailOptions): Promise<void> {
  const transporter = createTransporter()
  if (!transporter) {
    // SMTP not configured — log instead of sending so dev flows still work
    console.log(`[EMAIL] SMTP not configured. To=${opts.to} Subject="${opts.subject}"`)
    return
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? '"Futurely" <noreply@futurely.app>',
    ...opts,
  })
}
