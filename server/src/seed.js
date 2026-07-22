import bcrypt from 'bcryptjs';
import { User, Plan, Page, Lead, Event } from './models.js';

export async function seed() {
  const superEmail = process.env.SEED_SUPERADMIN_EMAIL;
  const superPass = process.env.SEED_SUPERADMIN_PASSWORD;
  if (superEmail && superPass) {
    const existing = await User.findOne({ role: 'superadmin' });
    if (!existing) {
      await User.create({
        email: superEmail, role: 'superadmin', pageQuota: 9999, canEditLibrary: true,
        passwordHash: await bcrypt.hash(superPass, 10),
      });
      console.log(`Seeded superadmin ${superEmail}`);
    } else if (existing.email !== superEmail.toLowerCase()) {
      // env vars are the source of truth for the superadmin account — but never
      // steal an email an admin already holds (would crash on the unique index)
      const clash = await User.findOne({ email: superEmail.toLowerCase(), role: { $ne: 'superadmin' } });
      if (clash) {
        console.warn(`Cannot set superadmin email to ${superEmail}: already used by an admin account. Keeping ${existing.email}.`);
      } else {
        existing.email = superEmail.toLowerCase();
        existing.passwordHash = await bcrypt.hash(superPass, 10);
        await existing.save();
        console.log(`Updated superadmin to ${superEmail}`);
      }
    }
  }

  // backfill ownerId on leads created before the field existed (page must still exist)
  const orphanLeads = await Lead.find({ ownerId: null }, 'pageId').lean();
  if (orphanLeads.length) {
    const pages = await Page.find({ _id: { $in: orphanLeads.map(l => l.pageId) } }, 'ownerId').lean();
    const ownerByPage = Object.fromEntries(pages.map(p => [p._id.toString(), p.ownerId]));
    const ops = orphanLeads
      .filter(l => l.pageId && ownerByPage[l.pageId.toString()])
      .map(l => ({ updateOne: { filter: { _id: l._id }, update: { ownerId: ownerByPage[l.pageId.toString()] } } }));
    if (ops.length) {
      await Lead.bulkWrite(ops);
      console.log(`Backfilled ownerId on ${ops.length} lead(s)`);
    }
  }

  if (process.env.SEED_DEMO !== 'true' || (await User.countDocuments({ role: 'admin' })) > 0) return;

  const admin = await User.create({
    email: 'demo@example.com', role: 'admin', pageQuota: 5, canEditLibrary: true,
    defaultWaNumber: '919876543210',
    passwordHash: await bcrypt.hash('demo1234', 10),
  });

  const planDefs = [
    { title: 'Pregnancy Care', icon: '🤰', subtitle: 'Conception to postpartum', description: 'Complete pregnancy program from conception to postpartum.', features: ['Unlimited expert consults', 'Weekly custom content', 'Prenatal yoga', 'Diet & nutrition plans', 'LIVE webinars', 'Growth tracker'], tags: ['Gynecologist', 'Nutritionist', 'Yoga'] },
    { title: 'Fertility Support', icon: '🌿', subtitle: 'Conception care for couples', description: 'Personalized fertility guidance for couples.', features: ['Personalized advice', 'Fertility tracking', 'Yoga & exercise', 'Expert webinars', 'Custom plans', 'Ongoing adjustments'], tags: ['Fertility Expert', 'Nutritionist', 'Coach'] },
    { title: 'PCOS/PCOD Care', icon: '💜', subtitle: 'Symptom management & lifestyle', description: 'Manage PCOS symptoms with lifestyle and expert care.', features: ['Diet & exercise plans', 'Expert team support', 'Stress assessment', 'Sleep tracker', 'Hormonal balance', 'Wellness resources'], tags: ['Gynaecologist', 'Psychologist', 'Nutritionist'] },
    { title: 'Diabetic Care', icon: '🩸', subtitle: 'Blood sugar control & reversal', description: 'Blood sugar control and reversal support.', features: ['Glucose monitoring', 'Diabetic diet plans', 'Exercise coaching', 'HbA1c tracking', 'Medication guidance', 'Expert webinars'], tags: ['Diabetologist', 'Nutritionist', 'Coach'] },
    { title: 'Liver Care', icon: '🫁', subtitle: 'Fatty liver & liver health', description: 'Fatty liver reversal and liver health.', features: ['Liver-friendly diet', 'Detox guidance', 'LFT tracking', 'Lifestyle correction', 'Expert consults', 'Progress reviews'], tags: ['Hepatologist', 'Nutritionist', 'Coach'] },
    { title: 'Weight Management', icon: '⚖️', subtitle: 'Sustainable weight loss', description: 'Sustainable weight loss with expert coaching.', features: ['Custom meal plans', 'Workout routines', 'Habit coaching', 'Progress tracker', 'Expert consults', 'Community support'], tags: ['Nutritionist', 'Fitness Coach', 'Psychologist'] },
  ];
  const plans = await Plan.insertMany(planDefs.map(p => ({ ...p, ownerId: admin._id })));

  const page = await Page.create({
    slug: 'dr-lekshmi', doctorName: 'Dr. Lekshmi Narendran', specialty: 'Obstetrics & Gynaecology',
    waNumber: '919876543210', planIds: plans.map(p => p._id), status: 'published', ownerId: admin._id,
  });

  // sample leads + 30 days of events so dashboards aren't empty
  const sampleLeads = [
    { name: 'Anita Sharma', phone: '+91 9812345621', plan: 3, status: 'new', hoursAgo: 2 },
    { name: 'Priya Nair', phone: '+91 9698765408', plan: 0, status: 'contacted', hoursAgo: 5 },
    { name: 'Rahul Verma', phone: '+91 9023456745', plan: 5, status: 'enrolled', hoursAgo: 26 },
    { name: 'Meena Iyer', phone: '+91 9734567863', plan: 4, status: 'new', hoursAgo: 50 },
  ];
  for (const l of sampleLeads) {
    await Lead.create({
      name: l.name, phone: l.phone, planId: plans[l.plan]._id, pageId: page._id, ownerId: admin._id,
      status: l.status, createdAt: new Date(Date.now() - l.hoursAgo * 36e5),
    });
  }

  const events = [];
  for (let d = 0; d < 30; d++) {
    const day = new Date(Date.now() - d * 864e5);
    const views = 8 + Math.floor(Math.random() * 20);
    for (let i = 0; i < views; i++) {
      const plan = plans[Math.floor(Math.random() * plans.length)];
      events.push({ pageId: page._id, planId: plan._id, type: 'view', at: day });
      if (Math.random() < 0.22) events.push({ pageId: page._id, planId: plan._id, type: 'enroll_click', at: day });
    }
  }
  await Event.insertMany(events);
  await Page.updateOne({ _id: page._id }, {
    'stats.views': events.filter(e => e.type === 'view').length,
    'stats.enrollClicks': events.filter(e => e.type === 'enroll_click').length,
  });
  console.log('Seeded demo admin (demo@example.com / demo1234), plans, page /p/dr-lekshmi, leads and events');
}
