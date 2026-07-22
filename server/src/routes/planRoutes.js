import { Router } from 'express';
import { Plan, Page, User } from '../models.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

async function withUsage(plans) {
  const pages = await Page.find({}, 'planIds').lean();
  const counts = {};
  for (const p of pages) for (const id of p.planIds || []) {
    const key = id.toString();
    counts[key] = (counts[key] || 0) + 1;
  }
  return plans.map(p => ({ ...p.toObject ? p.toObject() : p, usageCount: counts[p._id.toString()] || 0 }));
}

async function canEdit(req, res) {
  if (req.user.role === 'superadmin') return true;
  const me = await User.findById(req.user.id).lean();
  if (!me?.canEditLibrary) {
    res.status(403).json({ error: 'You do not have permission to edit the plan library' });
    return false;
  }
  return true;
}

router.get('/', async (_req, res) => {
  res.json(await withUsage(await Plan.find().sort({ createdAt: 1 })));
});

router.post('/', async (req, res) => {
  if (!(await canEdit(req, res))) return;
  const { title, icon = '🌿', subtitle = '', description = '', features = [], tags = [], watermarkUrl = '' } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Plan name is required' });
  const plan = await Plan.create({
    title, icon, subtitle, description,
    features: features.slice(0, 6), tags: tags.slice(0, 3), watermarkUrl, ownerId: req.user.id,
  });
  res.status(201).json(plan);
});

router.patch('/:id', async (req, res) => {
  if (!(await canEdit(req, res))) return;
  const plan = await Plan.findById(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  for (const key of ['title', 'icon', 'subtitle', 'description', 'watermarkUrl']) {
    if (req.body[key] !== undefined) plan[key] = req.body[key];
  }
  if (req.body.features !== undefined) plan.features = req.body.features.slice(0, 6);
  if (req.body.tags !== undefined) plan.tags = req.body.tags.slice(0, 3);
  await plan.save();
  res.json(plan);
});

router.delete('/:id', async (req, res) => {
  if (!(await canEdit(req, res))) return;
  const plan = await Plan.findById(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  await Page.updateMany({}, { $pull: { planIds: plan._id } });
  await plan.deleteOne();
  res.json({ ok: true });
});

export default router;
