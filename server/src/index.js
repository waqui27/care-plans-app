import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import pageRoutes from './routes/pageRoutes.js';
import planRoutes from './routes/planRoutes.js';
import leadRoutes from './routes/leadRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import publicRoutes, { getPublicPage } from './routes/publicRoutes.js';
import integrationRoutes from './routes/integrationRoutes.js';
import waWebhook from './routes/waWebhook.js';
import { seed } from './seed.js';

const app = express();
app.use(cors());
// keep the raw body so the WhatsApp webhook can verify Meta's signature
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));

app.use('/api/auth', authRoutes);
app.use('/api', publicRoutes);            // POST /api/track · POST /api/leads — public, mounted first so patient lead capture skips auth; GET/PATCH /api/leads fall through to the authed router below
app.use('/api/admins', adminRoutes);
app.use('/api/pages', pageRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/wa', waWebhook); // public: Meta webhook verify + events
app.get('/p/:slug', getPublicPage);       // public page JSON per spec
app.get('/api/public/:slug', getPublicPage); // alias used by the SPA (dev proxy forwards /api only)

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const port = process.env.PORT || 4000;
await mongoose.connect(process.env.MONGO_URI);
await seed();
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
