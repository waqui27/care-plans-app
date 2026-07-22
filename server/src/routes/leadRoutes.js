import { Router } from 'express';
import { Lead } from '../models.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

// scope by ownerId (survives page deletion), not by existing pages
function ownerScope(req) {
  return req.user.role === 'superadmin' ? {} : { ownerId: req.user.id };
}

function buildFilter(req) {
  const filter = ownerScope(req);
  if (req.query.page) filter.pageId = req.query.page;
  if (req.query.plan) filter.planId = req.query.plan;
  if (req.query.status) filter.status = req.query.status;
  return filter;
}

router.get('/', async (req, res) => {
  const leads = await Lead.find(buildFilter(req))
    .populate('planId', 'title icon').populate('pageId', 'slug doctorName')
    .sort({ createdAt: -1 }).limit(500);
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const base = ownerScope(req);
  const [total, newThisWeek, contacted, enrolled] = await Promise.all([
    Lead.countDocuments(base),
    Lead.countDocuments({ ...base, status: 'new', createdAt: { $gte: weekAgo } }),
    Lead.countDocuments({ ...base, status: 'contacted' }),
    Lead.countDocuments({ ...base, status: 'enrolled' }),
  ]);
  res.json({ leads, stats: { total, newThisWeek, contacted, enrolled } });
});

router.get('/export', async (req, res) => {
  const leads = await Lead.find(buildFilter(req))
    .populate('planId', 'title').populate('pageId', 'slug').sort({ createdAt: -1 });
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Name', 'Phone', 'Plan', 'Page', 'Status', 'Created'].join(',')];
  for (const l of leads) {
    rows.push([esc(l.name), esc(l.phone), esc(l.planId?.title), esc(l.pageId?.slug), esc(l.status), esc(l.createdAt.toISOString())].join(','));
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
  res.send(rows.join('\n'));
});

router.patch('/:id', async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, ...ownerScope(req) });
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (req.body.status) lead.status = req.body.status;
  if (req.body.note) lead.notes.push({ text: req.body.note, author: req.body.author || 'Admin' });
  await lead.save();
  res.json(await lead.populate([{ path: 'planId', select: 'title icon' }, { path: 'pageId', select: 'slug doctorName' }]));
});

export default router;
