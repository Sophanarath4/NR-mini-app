require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const BOT_USERNAME = (process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '');
const JWT_SECRET = process.env.JWT_SECRET || '';
const ADMIN_IDS = new Set((process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(x => x.trim()).filter(Boolean));

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !/^[a-f0-9]{64}$/i.test(a) || !/^[a-f0-9]{64}$/i.test(b)) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
function verifyTelegramLogin(data) {
  if (!BOT_TOKEN || !data || typeof data !== 'object' || !data.hash || !data.auth_date || !data.id) return false;
  const authDate = Number(data.auth_date);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDate) || authDate > now + 60 || now - authDate > 600) return false;
  const checkString = Object.keys(data).filter(k => k !== 'hash' && data[k] !== undefined && data[k] !== null)
    .sort().map(k => `${k}=${data[k]}`).join('\n');
  const secret = crypto.createHash('sha256').update(BOT_TOKEN).digest();
  const expected = crypto.createHmac('sha256', secret).update(checkString).digest('hex');
  return safeEqualHex(expected, String(data.hash));
}
function requireTelegramSession(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !JWT_SECRET) return res.status(401).json({ error: 'Telegram session required' });
  try { req.telegram = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Telegram session expired or invalid' }); }
}

app.get('/api/config', (_req, res) => res.json({ telegramBotUsername: BOT_USERNAME || null }));
app.get('/api/health', (_req, res) => res.json({ ok: true, telegramConfigured: !!(BOT_TOKEN && BOT_USERNAME), geminiConfigured: !!process.env.GEMINI_API_KEY }));

app.post('/api/telegram/verify', (req, res) => {
  if (!BOT_TOKEN || !BOT_USERNAME || !JWT_SECRET || JWT_SECRET.length < 32) {
    return res.status(503).json({ verified: false, error: 'Server Telegram/JWT configuration is incomplete' });
  }
  const data = req.body && req.body.telegram;
  if (!verifyTelegramLogin(data)) return res.status(401).json({ verified: false, error: 'Telegram signature invalid or login expired' });
  const telegramId = String(data.id);
  const role = ADMIN_IDS.has(telegramId) ? 'admin' : 'user';
  const user = { id: telegramId, username: data.username || null, firstName: data.first_name || '', lastName: data.last_name || '' };
  const sessionToken = jwt.sign({ telegramId, username: user.username, role }, JWT_SECRET, { expiresIn: '12h', issuer: 'fordtech-academy' });
  return res.json({ verified: true, sessionToken, role, username: user.username || telegramId, user });
});

app.post('/api/gemini/chat', requireTelegramSession, async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message || message.length > 5000) return res.status(400).json({ error: 'Message must be between 1 and 5000 characters' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Gemini API key is not configured' });
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: `You are FordTech Academy's helpful technology tutor. Answer clearly, safely, and preferably in Khmer when the user writes Khmer.\n\nUser question: ${message}` }] }] })
    });
    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: 'Gemini request failed', details: data?.error?.message || 'Upstream error' });
    const reply = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n').trim();
    if (!reply) return res.status(502).json({ error: 'Gemini returned an empty answer' });
    return res.json({ reply, model });
  } catch (err) { return res.status(502).json({ error: 'Could not reach Gemini service' }); }
});

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`FordTech Academy listening on http://localhost:${PORT}`));
