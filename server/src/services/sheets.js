import jwt from 'jsonwebtoken';
import { Lead, User } from '../models.js';

async function getAccessToken(cfg) {
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign({
    iss: cfg.clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }, cfg.privateKey, { algorithm: 'RS256' });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error_description || data.error || 'Google auth failed');
  return data.access_token;
}

export async function appendRow(cfg, row) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const token = await getAccessToken(cfg);
      const range = encodeURIComponent(`${cfg.sheetName || 'Leads'}!A1`);
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${cfg.spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ values: [row] }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || `Sheets API error ${res.status}`);
      }
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

function sheetsReady(cfg) {
  return cfg?.enabled && cfg.clientEmail && cfg.privateKey && cfg.spreadsheetId;
}

// Fire-and-forget append of a new lead to the page owner's sheet.
export async function syncLeadToSheet(leadId) {
  try {
    const lead = await Lead.findById(leadId)
      .populate('planId', 'title').populate('pageId', 'slug ownerId');
    if (!lead?.pageId) return;
    const owner = await User.findById(lead.pageId.ownerId);
    const cfg = owner?.integrations?.sheets;
    if (!sheetsReady(cfg) || owner.allowIntegrations?.sheets === false) return;
    try {
      await appendRow(cfg, [
        new Date(lead.createdAt).toISOString(), lead.name, lead.phone,
        lead.planId?.title || '', lead.pageId?.slug || '', lead.status,
      ]);
      owner.integrations.sheets.lastSyncAt = new Date();
      owner.integrations.sheets.lastError = '';
    } catch (e) {
      owner.integrations.sheets.lastError = e.message;
    }
    await owner.save();
  } catch (e) {
    console.error('Sheets sync failed:', e.message);
  }
}
