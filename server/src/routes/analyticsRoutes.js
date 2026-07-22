import { Router } from 'express';
import { Event, Page, Plan } from '../models.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const range = Math.min(parseInt(req.query.range, 10) || 30, 365);
  const since = new Date(Date.now() - range * 864e5);
  const prevSince = new Date(since.getTime() - range * 864e5);
  const filter = req.user.role === 'superadmin' ? {} : { ownerId: req.user.id };
  const pageIds = (await Page.find(filter, '_id').lean()).map(p => p._id);

  const events = await Event.find({ pageId: { $in: pageIds }, at: { $gte: since } }).lean();
  const prevEvents = await Event.find({ pageId: { $in: pageIds }, at: { $gte: prevSince, $lt: since } }).lean();

  const count = (list, type) => list.filter(e => e.type === type).length;
  const views = count(events, 'view');
  const enrolls = count(events, 'enroll_click');

  // weekly buckets, oldest first
  const weeks = Math.ceil(range / 7);
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(since.getTime() + i * 7 * 864e5);
    const end = new Date(start.getTime() + 7 * 864e5);
    const slice = events.filter(e => e.at >= start && e.at < end);
    return { label: `${start.getMonth() + 1}/${start.getDate()}`, views: count(slice, 'view'), enrolls: count(slice, 'enroll_click') };
  });

  const plans = await Plan.find().lean();
  const perPlan = plans.map(p => {
    const slice = events.filter(e => e.planId?.toString() === p._id.toString());
    const v = count(slice, 'view'), en = count(slice, 'enroll_click');
    return { planId: p._id, title: p.title, icon: p.icon, views: v, enrolls: en, ctr: v ? Math.round((en / v) * 100) : 0 };
  }).filter(p => p.views || p.enrolls);

  res.json({
    range, views, enrolls,
    ctr: views ? Math.round((enrolls / views) * 1000) / 10 : 0,
    prev: { views: count(prevEvents, 'view'), enrolls: count(prevEvents, 'enroll_click') },
    weekly: buckets, perPlan,
  });
});

export default router;
