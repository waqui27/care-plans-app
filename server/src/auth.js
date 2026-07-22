import jwt from 'jsonwebtoken';
import { User } from './models.js';

export function signToken(user) {
  return jwt.sign({ id: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // tokens live 7 days — make sure the account behind one is still active
  const account = await User.findById(req.user.id, 'status').lean();
  if (!account) return res.status(401).json({ error: 'Unauthorized' });
  if (account.status === 'suspended') return res.status(403).json({ error: 'Account suspended' });
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}
