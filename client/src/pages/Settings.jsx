import { useEffect, useState } from 'react';
import { api } from '../api.js';
import AdminLayout from '../components/AdminLayout.jsx';

function ChangePasswordModal({ onClose }) {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setDone(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not change password');
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ width: 380 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head"><div className="modal-title">Change password</div></div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div><label className="field-label">Current password</label>
              <input className="input" type="password" value={currentPassword} onChange={e => setCurrent(e.target.value)} required /></div>
            <div><label className="field-label">New password (min 8 characters)</label>
              <input className="input" type="password" value={newPassword} onChange={e => setNew(e.target.value)} required minLength={8} /></div>
            {error && <div className="form-error">{error}</div>}
            {done && <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>Password changed ✓</div>}
          </div>
          <div className="modal-foot">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" type="submit" disabled={done}>Change password</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Small step-by-step popup guide
function GuideModal({ title, steps, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ width: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head"><div className="modal-title">{title}</div></div>
        <div className="modal-body">
          <ol className="guide-steps">
            {steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
        <div className="modal-foot">
          <button className="btn-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}

function StatusChip({ allowed, enabled, configured, error }) {
  if (allowed === false) return <span className="chip chip-suspended">DISABLED BY SUPER ADMIN</span>;
  if (error) return <span className="chip chip-suspended">ERROR</span>;
  if (enabled) return <span className="chip chip-published">CONNECTED</span>;
  if (configured) return <span className="chip chip-contacted">READY — TURN ON</span>;
  return <span className="chip chip-draft">NOT CONNECTED</span>;
}

function BlockedNotice({ what }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--warn)', background: '#fff4dd', borderRadius: 9, padding: '10px 12px', lineHeight: 1.5 }}>
      {what} is turned off for your account by the super admin. Contact them to enable it.
    </div>
  );
}

export default function Settings() {
  const [me, setMe] = useState(null);
  const [waNumber, setWaNumber] = useState('');
  const [saved, setSaved] = useState('');
  const [pwModal, setPwModal] = useState(false);
  const [guide, setGuide] = useState(null); // 'sheets' | 'wa'

  const [integ, setInteg] = useState(null);
  const [sheetsForm, setSheetsForm] = useState({ serviceAccountJson: '', spreadsheetId: '', sheetName: 'Leads' });
  const [sheetsMsg, setSheetsMsg] = useState(null); // { ok, text }
  const [waSecret, setWaSecret] = useState('');
  const [waMsg, setWaMsg] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    api.get('/auth/me').then(r => { setMe(r.data); setWaNumber(r.data.defaultWaNumber || ''); });
    api.get('/integrations').then(r => {
      setInteg(r.data);
      setSheetsForm(f => ({ ...f, spreadsheetId: r.data.sheets.spreadsheetId, sheetName: r.data.sheets.sheetName }));
    });
  }, []);

  async function saveWa() {
    await api.patch('/auth/me', { defaultWaNumber: waNumber });
    setSaved('Saved ✓');
    setTimeout(() => setSaved(''), 1500);
  }

  async function saveSheets(enable) {
    setSheetsMsg(null);
    try {
      const { data } = await api.patch('/integrations/sheets', {
        ...sheetsForm,
        serviceAccountJson: sheetsForm.serviceAccountJson || undefined,
        enabled: enable,
      });
      setInteg(data);
      setSheetsForm(f => ({ ...f, serviceAccountJson: '', spreadsheetId: data.sheets.spreadsheetId, sheetName: data.sheets.sheetName }));
      setSheetsMsg({ ok: true, text: enable ? 'Connected — new leads will append to your sheet.' : 'Saved.' });
    } catch (err) {
      setSheetsMsg({ ok: false, text: err.response?.data?.error || 'Could not save' });
    }
  }

  async function testSheets() {
    setSheetsMsg(null);
    try {
      const { data } = await api.post('/integrations/sheets/test');
      setSheetsMsg({ ok: true, text: data.message });
      setInteg(i => ({ ...i, sheets: { ...i.sheets, lastError: '' } }));
    } catch (err) {
      setSheetsMsg({ ok: false, text: err.response?.data?.error || 'Test failed' });
    }
  }

  async function saveWaIntegration(patch) {
    setWaMsg('');
    try {
      const { data } = await api.patch('/integrations/wa', patch);
      setInteg(data);
      if (patch.enabled) setWaMsg('Webhook active — point Meta at the callback URL below.');
    } catch (err) {
      setWaMsg(err.response?.data?.error || 'Could not save');
    }
  }

  function copy(text, tag) {
    navigator.clipboard.writeText(text);
    setCopied(tag);
    setTimeout(() => setCopied(''), 1500);
  }

  // server-provided full URL (its own origin) — the client origin would be wrong when hosted separately
  const webhookUrl = integ ? (integ.wa.webhookUrl || `${location.origin}${integ.wa.webhookPath}`) : '';

  const sheetsGuide = [
    'Open console.cloud.google.com and create (or pick) a project.',
    'Search "Google Sheets API" in the API Library and click Enable.',
    'Go to IAM & Admin → Service Accounts → Create service account (any name, no roles needed).',
    'Open the account → Keys → Add key → Create new key → JSON. A .json file downloads.',
    'Paste the entire contents of that file into the "Service-account key" box here.',
    'Create a Google Sheet. Click Share and add the service account\'s email (from the JSON, ends in .iam.gserviceaccount.com) as Editor.',
    'Copy the sheet\'s URL (or just the long ID between /d/ and /edit) into "Spreadsheet" here.',
    'Click Save & connect, then Send test row — a row should appear in the sheet. New leads now append automatically.',
  ];

  const waGuide = [
    'Open developers.facebook.com → My Apps → Create app → type "Business", and add the WhatsApp product.',
    'This app must be reachable from the internet (deploy it, or tunnel with ngrok in development).',
    'Click "Turn on webhook" here — that generates your Verify token.',
    'In Meta: WhatsApp → Configuration → Webhook → Edit. Paste the Callback URL and Verify token shown below, then click Verify and save.',
    'Still in Meta, click Manage next to Webhook fields and subscribe to "messages".',
    '(Recommended) In App settings → Basic, copy the App secret and paste it here so we can verify Meta\'s signature.',
    'Done — when a patient messages your WhatsApp Business number, a lead is logged automatically and matched to a plan by keywords in their message.',
  ];

  return (
    <AdminLayout>
      <div className="page-head">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-sub">Account and integrations</div>
        </div>
      </div>
      <div className="settings-col">
        <div className="card">
          <div className="card-header">Account</div>
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label className="field-label">Email</label>
              <input className="input" value={me?.email || ''} readOnly style={{ background: 'var(--bg-admin)' }} /></div>
            <div><label className="field-label">Default WhatsApp number</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input" value={waNumber} onChange={e => setWaNumber(e.target.value)} placeholder="919876543210" />
                <button className="btn-ghost" onClick={saveWa}>{saved || 'Save'}</button>
              </div>
            </div>
            <button className="btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setPwModal(true)}>Change password</button>
          </div>
        </div>

        {integ && <>
          <div className="card">
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1 }}>📊 Google Sheets</span>
              <StatusChip allowed={integ.sheets.allowed} enabled={integ.sheets.enabled} configured={integ.sheets.configured} error={integ.sheets.lastError} />
              <button className="guide-link" onClick={() => setGuide('sheets')}>How to set up ?</button>
            </div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {integ.sheets.allowed === false && <BlockedNotice what="Google Sheets" />}
              {integ.sheets.allowed !== false && <>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                Every new lead is appended to your Google Sheet as a row: time, name, phone, plan, page, status.
              </div>
              <div><label className="field-label">Service-account key (paste the whole JSON file)</label>
                <textarea className="input" rows={3} value={sheetsForm.serviceAccountJson}
                  onChange={e => setSheetsForm(f => ({ ...f, serviceAccountJson: e.target.value }))}
                  placeholder={integ.sheets.hasKey ? `Saved for ${integ.sheets.clientEmail} — paste again to replace` : '{ "type": "service_account", "client_email": …, "private_key": … }'} />
              </div>
              <div className="form-grid-2">
                <div><label className="field-label">Spreadsheet (URL or ID)</label>
                  <input className="input" value={sheetsForm.spreadsheetId}
                    onChange={e => setSheetsForm(f => ({ ...f, spreadsheetId: e.target.value }))}
                    placeholder="https://docs.google.com/spreadsheets/d/…" /></div>
                <div><label className="field-label">Tab name</label>
                  <input className="input" value={sheetsForm.sheetName}
                    onChange={e => setSheetsForm(f => ({ ...f, sheetName: e.target.value }))} placeholder="Leads" /></div>
              </div>
              {sheetsMsg && <div style={{ fontSize: 12, fontWeight: 600, color: sheetsMsg.ok ? 'var(--accent)' : 'var(--danger)' }}>{sheetsMsg.text}</div>}
              {integ.sheets.lastError && !sheetsMsg && <div className="form-error">Last sync error: {integ.sheets.lastError}</div>}
              {integ.sheets.lastSyncAt && <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Last synced: {new Date(integ.sheets.lastSyncAt).toLocaleString()}</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {integ.sheets.enabled
                  ? <button className="btn-ghost" onClick={() => saveSheets(false)}>Disconnect</button>
                  : <button className="btn-primary" onClick={() => saveSheets(true)}>Save &amp; connect</button>}
                <button className="btn-secondary" onClick={testSheets}>Send test row</button>
              </div>
              </>}
            </div>
          </div>

          <div className="card">
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1 }}>💬 WhatsApp Business Cloud API</span>
              <StatusChip allowed={integ.wa.allowed} enabled={integ.wa.enabled} configured={!!integ.wa.verifyToken} error={integ.wa.lastError} />
              <button className="guide-link" onClick={() => setGuide('wa')}>How to set up ?</button>
            </div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {integ.wa.allowed === false && <BlockedNotice what="The WhatsApp Cloud API" />}
              {integ.wa.allowed !== false && <>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                When patients message your WhatsApp Business number, they're logged as leads automatically —
                matched to a plan by keywords in their message. The capture sheet becomes optional.
              </div>
              {integ.wa.enabled && <>
                <div><label className="field-label">Callback URL (paste into Meta)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="input mono" readOnly value={webhookUrl} style={{ background: 'var(--bg-admin)' }} />
                    <button className="btn-ghost" onClick={() => copy(webhookUrl, 'url')}>{copied === 'url' ? '✓' : 'Copy'}</button>
                  </div>
                </div>
                <div><label className="field-label">Verify token (paste into Meta)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="input mono" readOnly value={integ.wa.verifyToken} style={{ background: 'var(--bg-admin)' }} />
                    <button className="btn-ghost" onClick={() => copy(integ.wa.verifyToken, 'token')}>{copied === 'token' ? '✓' : 'Copy'}</button>
                    <button className="btn-ghost" onClick={() => saveWaIntegration({ regenerateToken: true })}>Regenerate</button>
                  </div>
                </div>
                <div><label className="field-label">App secret (optional — verifies Meta's signature)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="input" type="password" value={waSecret} onChange={e => setWaSecret(e.target.value)}
                      placeholder={integ.wa.hasSecret ? 'Saved — paste again to replace' : 'From Meta → App settings → Basic'} />
                    <button className="btn-ghost" onClick={() => { saveWaIntegration({ appSecret: waSecret }); setWaSecret(''); }}>Save</button>
                  </div>
                </div>
                {integ.wa.lastEventAt && <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Last message received: {new Date(integ.wa.lastEventAt).toLocaleString()}</div>}
              </>}
              {integ.wa.lastError && <div className="form-error">{integ.wa.lastError}</div>}
              {waMsg && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{waMsg}</div>}
              <div>
                {integ.wa.enabled
                  ? <button className="btn-ghost" onClick={() => saveWaIntegration({ enabled: false })}>Turn off webhook</button>
                  : <button className="btn-primary" onClick={() => saveWaIntegration({ enabled: true })}>Turn on webhook</button>}
              </div>
              </>}
            </div>
          </div>
        </>}
      </div>
      {pwModal && <ChangePasswordModal onClose={() => setPwModal(false)} />}
      {guide === 'sheets' && <GuideModal title="Set up Google Sheets sync" steps={sheetsGuide} onClose={() => setGuide(null)} />}
      {guide === 'wa' && <GuideModal title="Set up the WhatsApp Cloud API" steps={waGuide} onClose={() => setGuide(null)} />}
    </AdminLayout>
  );
}
