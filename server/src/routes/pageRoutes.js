import { Router } from 'express';
import { Page, User } from '../models.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

router.get('/', async (req, res) => {
  const filter = req.user.role === 'superadmin' ? {} : { ownerId: req.user.id };
  const pages = await Page.find(filter).populate('planIds').sort({ createdAt: -1 });
  const me = await User.findById(req.user.id).lean();
  res.json({ pages, quota: me?.pageQuota ?? 0, used: req.user.role === 'superadmin' ? pages.length : await Page.countDocuments({ ownerId: req.user.id }) });
});

router.get('/check-slug', async (req, res) => {
  const slug = String(req.query.slug || '').toLowerCase().trim();
  if (!SLUG_RE.test(slug)) return res.json({ slug, available: false, reason: 'invalid' });
  const clash = await Page.findOne({ slug, _id: { $ne: req.query.excludeId || undefined } });
  res.json({ slug, available: !clash });
});

router.post('/', async (req, res) => {
  const me = await User.findById(req.user.id);
  if (!me || me.status !== 'active') return res.status(403).json({ error: 'Account inactive' });
  const used = await Page.countDocuments({ ownerId: me._id });
  if (me.role !== 'superadmin' && used >= me.pageQuota) {
    return res.status(403).json({ error: `Page quota reached (${me.pageQuota}). Ask your super admin to raise it.` });
  }
  const { slug, doctorName, specialty = '', waNumber = '', template = 'green-grid', planIds = [] } = req.body || {};
  if (!slug || !doctorName) return res.status(400).json({ error: 'Slug and doctor name are required' });
  if (!SLUG_RE.test(slug)) return res.status(400).json({ error: 'Slug must be kebab-case (letters, numbers, dashes)' });
  if (await Page.findOne({ slug })) return res.status(409).json({ error: 'That slug is taken' });
  const page = await Page.create({ slug, doctorName, specialty, waNumber, template, planIds: planIds.slice(0, 12), ownerId: me._id });
  res.status(201).json(page);
});

async function ownedPage(req, res) {
  const page = await Page.findById(req.params.id);
  if (!page) { res.status(404).json({ error: 'Page not found' }); return null; }
  if (req.user.role !== 'superadmin' && page.ownerId.toString() !== req.user.id) {
    res.status(403).json({ error: 'Not your page' }); return null;
  }
  return page;
}

router.get('/:id', async (req, res) => {
  const page = await ownedPage(req, res);
  if (page) res.json(await page.populate('planIds'));
});

router.patch('/:id', async (req, res) => {
  const page = await ownedPage(req, res);
  if (!page) return;
  const editable = ['slug', 'doctorName', 'specialty', 'waNumber', 'heroHeadline', 'heroSub', 'brandName',
    'headerRightText', 'footerText', 'template', 'accentColor', 'logoUrl', 'planIds', 'waTemplate', 'leadCapture'];
  for (const key of editable) if (req.body[key] !== undefined) page[key] = req.body[key];
  if (req.body.slug !== undefined && !SLUG_RE.test(page.slug)) return res.status(400).json({ error: 'Invalid slug' });
  page.planIds = page.planIds.slice(0, 12);
  try {
    await page.save();
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'That slug is taken' });
    throw e;
  }
  res.json(await page.populate('planIds'));
});

router.delete('/:id', async (req, res) => {
  const page = await ownedPage(req, res);
  if (!page) return;
  await page.deleteOne(); // leads are intentionally kept
  res.json({ ok: true });
});

router.post('/:id/publish', async (req, res) => {
  const page = await ownedPage(req, res);
  if (!page) return;
  page.status = req.body?.status === 'draft' ? 'draft' : 'published';
  await page.save();
  res.json(page);
});

export default router;
