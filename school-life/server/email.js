// Welcome email sender.
// Configure ONE of these (environment variables):
//   GMAIL_USER + GMAIL_APP_PASSWORD   send from your Gmail (needs a Google "App Password")
//   SMTP_URL (+ MAIL_FROM)             any SMTP server, e.g. smtps://user:pass@smtp.example.com
// With neither set, emails are saved to server/outbox/ so you can preview them.
import fs from 'node:fs/promises';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { welcomeSubject, welcomeText, welcomeHtml } from '../src/core/welcome.js';

export function createMailer(env = process.env, { outboxDir } = {}) {
  let transport = null;
  let from = null;
  let kind = 'none';
  if (env.MAIL_TRANSPORT === 'json') {
    transport = nodemailer.createTransport({ jsonTransport: true });
    from = '"School Life" <test@example.com>';
    kind = 'json';
  } else if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) {
    transport = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD.replace(/\s+/g, '') },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    from = `"School Life" <${env.GMAIL_USER}>`;
    kind = 'gmail';
  } else if (env.SMTP_URL) {
    transport = nodemailer.createTransport(env.SMTP_URL);
    from = env.MAIL_FROM || '"School Life" <no-reply@localhost>';
    kind = 'smtp';
  }

  return {
    kind,
    configured: !!transport,
    sent: [],
    async sendWelcome(to) {
      const message = { from, to, subject: welcomeSubject(), text: welcomeText(to), html: welcomeHtml(to) };
      if (!transport) {
        if (outboxDir) {
          try {
            await fs.mkdir(outboxDir, { recursive: true });
            const safe = to.replace(/[^a-z0-9@._-]/gi, '_');
            await fs.writeFile(path.join(outboxDir, `${Date.now()}-${safe}.html`), message.html, 'utf8');
          } catch (e) {
            /* preview is best-effort */
          }
        }
        return { status: 'not_configured' };
      }
      try {
        const info = await Promise.race([
          transport.sendMail(message),
          new Promise((_, rej) => setTimeout(() => rej(new Error('Email timed out')), 20000)),
        ]);
        this.sent.push({ to, info });
        return { status: 'sent' };
      } catch (err) {
        console.error('[email] could not send welcome email:', err && err.message);
        return { status: 'failed' };
      }
    },
  };
}
