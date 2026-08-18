import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import dataRoutes from './routes/data.js';
import adminRoutes from './routes/admin.js';
import { sendAttackAlert } from './alert.js';

const app = express();

// This API only ever serves static reference JSON (colleges/roles/roadmap/
// company data) — no HTML is rendered, so a strict default-deny CSP is safe
// and helmet's other defaults (nosniff, no X-Powered-By, frameguard, HSTS,
// referrer-policy, etc.) apply cleanly on top of that.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));

// Restrict to the actual frontend origin(s) instead of the previous
// wildcard (cors() with no options allows every origin). Set
// ALLOWED_ORIGINS as a comma-separated list in production; local dev
// defaults cover the Vite dev server ports.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
}));

app.use(express.json({ limit: '200kb' }));

function clientIp(req) {
  return req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip;
}

// App-layer abuse mitigation — this slows down scripted/brute-force request
// floods against this API, but it is NOT real DDoS protection. Genuine DDoS
// mitigation happens upstream (Cloudflare, your host's edge network, a WAF)
// before traffic ever reaches this process; no amount of in-app code can
// absorb a real volumetric attack.
// Loopback traffic is skipped entirely: in this local-dev setup every request
// (the app itself, and any local testing) comes from the same machine, so a
// shared-IP bucket trips constantly on totally normal usage — it doesn't
// protect anything here since a real attacker can never appear as ::1/127.0.0.1
// in the first place. Once deployed, all real traffic arrives as genuine
// external IPs and gets the limit enforced as intended.
const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => LOOPBACK_IPS.has(clientIp(req)),
  handler: (req, res) => {
    const ip = clientIp(req);
    console.warn(`[rate-limit] blocked ${ip} on ${req.method} ${req.originalUrl}`);
    sendAttackAlert({ ip, method: req.method, path: req.originalUrl, reason: 'Rate limit exceeded' });
    res.status(429).json({ message: 'Too many requests, slow down.' });
  },
});
app.use(limiter);

app.use('/api/data', dataRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Catches anything that isn't a real route — a common recon/attack pattern
// (probing for /admin, /.env, /wp-login.php, etc.) worth alerting on too.
app.use((req, res) => {
  const ip = clientIp(req);
  console.warn(`[404] ${ip} probed ${req.method} ${req.originalUrl}`);
  sendAttackAlert({ ip, method: req.method, path: req.originalUrl, reason: 'Unknown route probed' });
  res.status(404).json({ message: 'Not found' });
});

// Explicit error handler so a rejected CORS origin (or any other thrown
// error) returns a clean JSON response instead of Express's default HTML
// error page, which can leak stack traces/file paths outside production.
app.use((err, req, res, _next) => {
  const ip = clientIp(req);
  console.warn(`[error] ${ip} on ${req.method} ${req.originalUrl}: ${err.message}`);
  if (err.message === 'Not allowed by CORS') {
    sendAttackAlert({ ip, method: req.method, path: req.originalUrl, reason: 'Disallowed CORS origin' });
    return res.status(403).json({ message: 'Forbidden' });
  }
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`PathPilot API listening on http://localhost:${PORT}`);
});
