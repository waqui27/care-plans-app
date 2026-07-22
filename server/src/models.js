import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['superadmin', 'admin'], default: 'admin' },
  pageQuota: { type: Number, default: 5 },
  canEditLibrary: { type: Boolean, default: true },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  defaultWaNumber: { type: String, default: '' },
  // superadmin-controlled: whether this admin may use each integration
  allowIntegrations: {
    sheets: { type: Boolean, default: true },
    wa: { type: Boolean, default: true },
  },
  integrations: {
    sheets: {
      enabled: { type: Boolean, default: false },
      clientEmail: { type: String, default: '' },
      privateKey: { type: String, default: '' },
      spreadsheetId: { type: String, default: '' },
      sheetName: { type: String, default: 'Leads' },
      lastSyncAt: Date,
      lastError: { type: String, default: '' },
    },
    wa: {
      enabled: { type: Boolean, default: false },
      verifyToken: { type: String, default: '' },
      appSecret: { type: String, default: '' },
      lastEventAt: Date,
      lastError: { type: String, default: '' },
    },
  },
}, { timestamps: true });

const planSchema = new Schema({
  title: { type: String, required: true },
  icon: { type: String, default: '🌿' },
  subtitle: { type: String, default: '' },
  description: { type: String, default: '' },
  features: { type: [String], default: [] },
  tags: { type: [String], default: [] },
  watermarkUrl: { type: String, default: '' },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const pageSchema = new Schema({
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  doctorName: { type: String, required: true },
  specialty: { type: String, default: '' },
  waNumber: { type: String, default: '' },
  heroHeadline: { type: String, default: 'Choose your care plan' },
  heroSub: { type: String, default: 'Expert-led programs · enroll in one tap on WhatsApp' },
  brandName: { type: String, default: 'Mamily Care' },
  headerRightText: { type: String, default: 'TatvaCare' },
  footerText: { type: String, default: 'support@mamily.in · Powered by Mamily • TatvaCare' },
  template: { type: String, enum: ['green-grid', 'classic-list', 'bold-dark'], default: 'green-grid' },
  accentColor: { type: String, default: '#2f7a4e' },
  logoUrl: { type: String, default: '' },
  planIds: [{ type: Schema.Types.ObjectId, ref: 'Plan' }],
  waTemplate: { type: String, default: "Hi, I'm interested in the {plan} plan at {doctor}. Please share more details." },
  leadCapture: { type: Boolean, default: true },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  stats: {
    views: { type: Number, default: 0 },
    enrollClicks: { type: Number, default: 0 },
  },
}, { timestamps: true });

const leadSchema = new Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  planId: { type: Schema.Types.ObjectId, ref: 'Plan' },
  pageId: { type: Schema.Types.ObjectId, ref: 'Page' },
  // denormalized from the page so leads survive page deletion ("leads are kept")
  ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['new', 'contacted', 'enrolled', 'closed'], default: 'new' },
  notes: [{
    text: String,
    author: String,
    at: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

const eventSchema = new Schema({
  pageId: { type: Schema.Types.ObjectId, ref: 'Page', required: true },
  planId: { type: Schema.Types.ObjectId, ref: 'Plan' },
  type: { type: String, enum: ['view', 'enroll_click'], required: true },
  at: { type: Date, default: Date.now },
});
eventSchema.index({ pageId: 1, at: -1 });

export const User = mongoose.model('User', userSchema);
export const Plan = mongoose.model('Plan', planSchema);
export const Page = mongoose.model('Page', pageSchema);
export const Lead = mongoose.model('Lead', leadSchema);
export const Event = mongoose.model('Event', eventSchema);
