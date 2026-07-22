import { Router } from 'express';
import crypto from 'crypto';
import { User } from '../models.js';
import { requireAuth } from '../auth.js';
import { appendRow } from '../services/sheets.js';

const router = Router();
router.use(requireAuth);

function view(user, req) {
  const s = user.integrations?.sheets || {};
  const w = user.integrations?.wa || {};
  // Meta must reach the SERVER, so build the callback from the API's own public
  // origin — PUBLIC_API_URL if set, otherwise the incoming request's host.
  const apiOrigin = (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  const webhookPath = `/api/wa/webhook/${user._id}`;
  return {
    sheets: {
      allowed: user.allowIntegrations?.sheets !== false,
      enabled: !!s.enabled,
      clientEmail: s.clientEmail || '',
      hasKey: !!s.privateKey,
      spreadsheetId: s.spreadsheetId || '',
      sheetName: s.sheetName || 'Leads',
      lastSyncAt: s.lastSyncAt || null,
      lastError: s.lastError || '',
      configured: !!(s.clientEmail && s.privateKey && s.spreadsheetId),
    },
    wa: {
      allowed: user.allowIntegrations?.wa !== false,
      enabled: !!w.enabled,
      verifyToken: w.verifyToken || '',
      hasSecret: !!w.appSecret,
      lastEventAt: w.lastEventAt || null,
      lastError: w.lastError || '',
      webhookPath,
      webhookUrl: `${apiOrigin}${webhookPath}`,
    },
  };
}

router.get('/', async (req, res) => {
  const me = await User.findById(req.user.id);
  if (!me) return res.status(404).json({ error: 'Account not found' });
  res.json(view(me, req));
});

router.patch('/sheets', async (req, res) => {
  const me = await User.findById(req.user.id);
  if (!me) return res.status(404).json({ error: 'Account not found' });
  if (me.allowIntegrations?.sheets === false) return res.status(403).json({ error: 'Google Sheets is disabled for your account by the super admin' });
  const s = me.integrations.sheets;
  const { serviceAccountJson, spreadsheetId, sheetName, enabled } = req.body || {};

  if (serviceAccountJson !== undefined && serviceAccountJson !== '') {
    let parsed;
    try {
      parsed = JSON.parse(serviceAccountJson);
    } catch {
      return res.status(400).json({ error: 'That is not valid JSON — paste the whole service-account key file' });
    }
    if (!parsed.client_email || !parsed.private_key) {
      return res.status(400).json({ error: 'The JSON must contain client_email and private_key (service-account key file)' });
    }
    s.clientEmail = parsed.client_email;
    s.privateKey = parsed.private_key;
  }
  if (spreadsheetId !== undefined) {
    // accept a bare ID or a full sheet URL
    const m = String(spreadsheetId).match(/\/d\/([a-zA-Z0-9-_]+)/);
    s.spreadsheetId = m ? m[1] : String(spreadsheetId).trim();
  }
  if (sheetName !== undefined) s.sheetName = String(sheetName).trim() || 'Leads';
  if (enabled !== undefined) s.enabled = !!enabled;
  if (s.enabled && !(s.clientEmail && s.privateKey && s.spreadsheetId)) {
    return res.status(400).json({ error: 'Add the service-account JSON and spreadsheet ID before enabling' });
  }
  s.lastError = '';
  await me.save();
  res.json(view(me, req));
});

router.post('/sheets/test', async (req, res) => {
  const me = await User.findById(req.user.id);
  if (me?.allowIntegrations?.sheets === false) return res.status(403).json({ error: 'Google Sheets is disabled for your account by the super admin' });
  const s = me?.integrations?.sheets;
  if (!s?.clientEmail || !s.privateKey || !s.spreadsheetId) {
    return res.status(400).json({ error: 'Save the service-account JSON and spreadsheet ID first' });
  }
  try {
    await appendRow(s, [new Date().toISOString(), 'Test row', '—', '—', '—', 'test']);
    s.lastSyncAt = new Date();
    s.lastError = '';
    await me.save();
    res.json({ ok: true, message: 'Test row appended — check your sheet' });
  } catch (e) {
    s.lastError = e.message;
    await me.save();
    res.status(502).json({ error: e.message });
  }
});

router.patch('/wa', async (req, res) => {
  const me = await User.findById(req.user.id);
  if (!me) return res.status(404).json({ error: 'Account not found' });
  if (me.allowIntegrations?.wa === false) return res.status(403).json({ error: 'The WhatsApp Cloud API is disabled for your account by the super admin' });
  const w = me.integrations.wa;
  const { enabled, appSecret, regenerateToken } = req.body || {};
  if (regenerateToken || (!w.verifyToken && enabled)) {
    w.verifyToken = crypto.randomBytes(12).toString('hex');
  }
  if (appSecret !== undefined) w.appSecret = String(appSecret).trim();
  if (enabled !== undefined) w.enabled = !!enabled;
  w.lastError = '';
  await me.save();
  res.json(view(me, req));
});

export default router;
