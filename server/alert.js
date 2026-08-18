import nodemailer from 'nodemailer';

// Requires real SMTP credentials in env vars before it can actually send —
// without them this just logs (the rate-limit/404 handlers already console.warn
// the IP themselves), so nothing breaks if email isn't configured yet.
// Gmail: use an App Password (myaccount.google.com/apppasswords), not your
// normal password — SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_SECURE=true.
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ALERT_EMAIL_TO, ALERT_EMAIL_FROM } = process.env;
const alertRecipient = ALERT_EMAIL_TO || 'hetsukhadia5333@gmail.com';

const transporter = SMTP_HOST && SMTP_USER && SMTP_PASS
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

// Per-IP cooldown so a burst of blocked requests (or a determined attacker
// deliberately spamming 404s) sends one alert, not one email per request —
// otherwise the alert system itself becomes an email-bombing vector against
// the recipient's inbox.
const ALERT_COOLDOWN_MS = 15 * 60 * 1000;
const lastAlertByIp = new Map();

export async function sendAttackAlert({ ip, method, path, reason }) {
  const now = Date.now();
  const last = lastAlertByIp.get(ip) || 0;
  if (now - last < ALERT_COOLDOWN_MS) return;
  lastAlertByIp.set(ip, now);

  if (!transporter) {
    console.warn('[alert] SMTP not configured — set SMTP_HOST/SMTP_USER/SMTP_PASS in .env to enable email alerts.');
    return;
  }

  try {
    await transporter.sendMail({
      from: ALERT_EMAIL_FROM || SMTP_USER,
      to: alertRecipient,
      subject: `PathPilot API alert: ${reason} from ${ip}`,
      text: `${reason}\n\nIP: ${ip}\nRequest: ${method} ${path}\nTime: ${new Date(now).toISOString()}`,
    });
  } catch (err) {
    console.error('[alert] Failed to send attack alert email:', err.message);
  }
}
