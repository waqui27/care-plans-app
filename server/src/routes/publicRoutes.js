import { Router } from 'express';
import { Page, Lead, Event, Plan } from '../models.js';
import { syncLeadToSheet } from '../services/sheets.js';

const router = Router();

// naive per-IP sliding-window rate limit for the unauthenticated write endpoints
const hits = new Map(); // ip -> [timestamps]
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || '?';
    const list = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (list.length >= max) return res.status(429).json({ error: 'Too many requests — try again shortly' });
    list.push(now);
    hits.set(key, list);
    if (hits.size > 10000) hits.clear(); // crude memory cap
    next();
  };
}

export async function getPublicPage(req, res) {
  const page = await Page.findOne({ slug: String(req.params.slug).toLowerCase(), status: 'published' }).populate('planIds');
  if (!page) return res.status(404).json({ error: 'This page isn\'t available' });
  res.json({
    id: page._id, slug: page.slug, doctorName: page.doctorName, specialty: page.specialty,
    waNumber: page.waNumber, heroHeadline: page.heroHeadline, heroSub: page.heroSub,
    brandName: page.brandName, headerRightText: page.headerRightText,
    footerText: page.footerText, template: page.template,
    accentColor: page.accentColor, logoUrl: page.logoUrl, waTemplate: page.waTemplate,
    leadCapture: page.leadCapture,
    plans: page.planIds.map(p => ({
      id: p._id, title: p.title, icon: p.icon, subtitle: p.subtitle,
      features: p.features, tags: p.tags, watermarkUrl: p.watermarkUrl,
    })),
  });
}

router.post('/track', rateLimit(60, 60_000), async (req, res) => {
  const { pageId, planId, type } = req.body || {};
  if (!pageId || !['view', 'enroll_click'].includes(type)) return res.status(400).json({ error: 'Bad event' });
  const page = await Page.findById(pageId);
  if (!page) return res.status(404).json({ error: 'Page not found' });
  await Event.create({ pageId, planId: planId || undefined, type });
  const field = type === 'view' ? 'stats.views' : 'stats.enrollClicks';
  await Page.updateOne({ _id: pageId }, { $inc: { [field]: 1 } });
  res.json({ ok: true });
});

router.post('/leads', rateLimit(10, 60_000), async (req, res) => {
  const { name, phone, planId, pageId } = req.body || {};
  if (!name || !phone || !pageId) return res.status(400).json({ error: 'Name, phone and page are required' });
  const page = await Page.findById(pageId);
  if (!page) return res.status(404).json({ error: 'Page not found' });
  if (planId && !(await Plan.findById(planId))) return res.status(404).json({ error: 'Plan not found' });
  const lead = await Lead.create({ name, phone, planId, pageId, ownerId: page.ownerId });
  syncLeadToSheet(lead._id); // fire-and-forget Google Sheets append
  res.status(201).json({ id: lead._id });
});

export default router;
