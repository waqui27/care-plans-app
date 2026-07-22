import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models.js';
import { signToken, requireAuth } from '../auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended' });
  res.json({ token: signToken(user), role: user.role, email: user.email });
});

router.get('/me', requireAuth, async (req, res) => {
  const me = await User.findById(req.user.id).lean();
  if (!me) return res.status(404).json({ error: 'Account not found' });
  res.json({ email: me.email, role: me.role, defaultWaNumber: me.defaultWaNumber, canEditLibrary: me.canEditLibrary });
});

router.patch('/me', requireAuth, async (req, res) => {
  const me = await User.findById(req.user.id);
  if (!me) return res.status(404).json({ error: 'Account not found' });
  if (req.body.defaultWaNumber !== undefined) me.defaultWaNumber = req.body.defaultWaNumber;
  await me.save();
  res.json({ ok: true });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password are required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  const me = await User.findById(req.user.id);
  if (!me || !(await bcrypt.compare(currentPassword, me.passwordHash))) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  me.passwordHash = await bcrypt.hash(newPassword, 10);
  await me.save();
  res.json({ ok: true });
});

export default router;
