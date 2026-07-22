import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User, Page, Event } from '../models.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth, requireRole('superadmin'));

router.get('/', async (_req, res) => {
  const admins = await User.find({ role: 'admin' }).sort({ createdAt: 1 }).lean();
  const usage = await Page.aggregate([{ $group: { _id: '$ownerId', count: { $sum: 1 } } }]);
  const usageMap = Object.fromEntries(usage.map(u => [u._id.toString(), u.count]));
  res.json(admins.map(a => ({
    id: a._id, email: a.email, pageQuota: a.pageQuota, canEditLibrary: a.canEditLibrary,
    status: a.status, pagesUsed: usageMap[a._id.toString()] || 0,
    allowSheets: a.allowIntegrations?.sheets !== false,
    allowWa: a.allowIntegrations?.wa !== false,
  })));
});

router.get('/stats', async (_req, res) => {
  const [admins, publishedPages, enrolls30d] = await Promise.all([
    User.countDocuments({ role: 'admin' }),
    Page.countDocuments({ status: 'published' }),
    Event.countDocuments({ type: 'enroll_click', at: { $gte: new Date(Date.now() - 30 * 864e5) } }),
  ]);
  res.json({ admins, publishedPages, enrolls30d });
});

function parseQuota(raw) {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1) return null;
  return Math.min(n, 9999);
}

router.post('/', async (req, res) => {
  const { email, password, canEditLibrary = false } = req.body || {};
  const pageQuota = parseQuota(req.body?.pageQuota ?? 5);
  if (pageQuota === null) return res.status(400).json({ error: 'Page quota must be a positive number' });
  if (!email || !password) return res.status(400).json({ error: 'Email and temp password are required' });
  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    if (existing.role === 'superadmin') {
      return res.status(409).json({ error: "That email belongs to the super admin account — it can't be reused for an admin" });
    }
    return res.status(409).json({ error: 'An account with that email already exists' });
  }
  try {
    const user = await User.create({
      email: normalizedEmail, role: 'admin', pageQuota, canEditLibrary,
      passwordHash: await bcrypt.hash(password, 10),
    });
    res.status(201).json({ id: user._id, email: user.email });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'An account with that email already exists' });
    throw e;
  }
});

router.patch('/:id', async (req, res) => {
  const allowed = {};
  for (const key of ['pageQuota', 'canEditLibrary', 'status']) {
    if (req.body[key] !== undefined) allowed[key] = req.body[key];
  }
  if (allowed.pageQuota !== undefined) {
    allowed.pageQuota = parseQuota(allowed.pageQuota);
    if (allowed.pageQuota === null) return res.status(400).json({ error: 'Page quota must be a positive number' });
  }
  if (req.body.allowSheets !== undefined) allowed['allowIntegrations.sheets'] = !!req.body.allowSheets;
  if (req.body.allowWa !== undefined) allowed['allowIntegrations.wa'] = !!req.body.allowWa;
  const user = await User.findOneAndUpdate({ _id: req.params.id, role: 'admin' }, allowed, { new: true });
  if (!user) return res.status(404).json({ error: 'Admin not found' });
  res.json({
    id: user._id, email: user.email, pageQuota: user.pageQuota, canEditLibrary: user.canEditLibrary, status: user.status,
    allowSheets: user.allowIntegrations?.sheets !== false, allowWa: user.allowIntegrations?.wa !== false,
  });
});

export default router;
