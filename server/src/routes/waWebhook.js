import { Router } from 'express';
import crypto from 'crypto';
import { User, Page, Lead, Plan } from '../models.js';
import { syncLeadToSheet } from '../services/sheets.js';

const router = Router();

// Meta webhook verification handshake
router.get('/webhook/:adminId', async (req, res) => {
  const user = await User.findById(req.params.adminId).catch(() => null);
  const token = user?.integrations?.wa?.verifyToken;
  if (
    req.query['hub.mode'] === 'subscribe' &&
    user?.allowIntegrations?.wa !== false &&
    token && req.query['hub.verify_token'] === token
  ) {
    return res.send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});

// Incoming messages → upsert leads
router.post('/webhook/:adminId', async (req, res) => {
  res.sendStatus(200); // ack immediately; Meta retries on non-200
  try {
    const user = await User.findById(req.params.adminId);
    const cfg = user?.integrations?.wa;
    if (!cfg?.enabled || user.allowIntegrations?.wa === false) return;

    // verify signature when an app secret is configured
    if (cfg.appSecret && req.rawBody) {
      const expected = 'sha256=' + crypto.createHmac('sha256', cfg.appSecret).update(req.rawBody).digest('hex');
      const got = req.headers['x-hub-signature-256'] || '';
      if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got.padEnd(expected.length).slice(0, expected.length)))) {
        cfg.lastError = 'Webhook signature mismatch — check the app secret';
        await user.save();
        return;
      }
    }

    const pages = await Page.find({ ownerId: user._id }).populate('planIds', 'title').sort({ status: -1, updatedAt: -1 });
    if (pages.length === 0) return;
    const pageIds = pages.map(p => p._id);

    for (const entry of req.body?.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const contacts = value.contacts || [];
        for (const msg of value.messages || []) {
          const phone = `+${msg.from}`;
          const name = contacts.find(c => c.wa_id === msg.from)?.profile?.name || phone;
          const text = msg.text?.body || msg.button?.text || '';

          // match a plan by title keyword — prefer a page carrying that plan,
          // else fall back to any library plan on the owner's latest page
          const lower = text.toLowerCase();
          let plan = null, page = pages[0];
          for (const p of pages) {
            const hit = (p.planIds || []).find(pl => lower.includes(pl.title.toLowerCase()));
            if (hit) { plan = hit; page = p; break; }
          }
          if (!plan && text) {
            const all = await Plan.find({}, 'title').lean();
            plan = all.find(pl => lower.includes(pl.title.toLowerCase())) || null;
          }

          const existing = await Lead.findOne({ phone, $or: [{ ownerId: user._id }, { pageId: { $in: pageIds } }] }).sort({ createdAt: -1 });
          if (existing) {
            if (text) existing.notes.push({ text: `WhatsApp: "${text}"`, author: 'Cloud API' });
            if (plan && !existing.planId) existing.planId = plan._id;
            await existing.save();
          } else {
            const lead = await Lead.create({
              name, phone, planId: plan?._id, pageId: page._id, ownerId: user._id,
              notes: text ? [{ text: `WhatsApp: "${text}"`, author: 'Cloud API' }] : [],
            });
            syncLeadToSheet(lead._id); // fire-and-forget
          }
        }
      }
    }
    user.integrations.wa.lastEventAt = new Date();
    user.integrations.wa.lastError = '';
    await user.save();
  } catch (e) {
    console.error('WA webhook error:', e.message);
  }
});

export default router;
