import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, auth } from '../api.js';

const PRESETS = [3, 5, 10];
const INF = 9999;

// Quota picker: preset segments, ∞, or a custom number
function QuotaControl({ value, onChange }) {
  const isCustomValue = !PRESETS.includes(value) && value < INF;
  const [custom, setCustom] = useState(isCustomValue);
  return (
    <div>
      <div className="seg-control">
        {PRESETS.map(q => (
          <button type="button" key={q} className={!custom && value === q ? 'active' : ''}
            onClick={() => { setCustom(false); onChange(q); }}>{q}</button>
        ))}
        <button type="button" className={!custom && value >= INF ? 'active' : ''}
          onClick={() => { setCustom(false); onChange(INF); }}>∞</button>
        <button type="button" className={custom ? 'active' : ''}
          onClick={() => { setCustom(true); if (value >= INF) onChange(15); }}>Custom</button>
      </div>
      {custom && (
        <input className="input" type="number" min={1} max={INF - 1} style={{ marginTop: 8 }}
          value={value >= INF ? '' : value} placeholder="Number of pages"
          onChange={e => {
            const n = parseInt(e.target.value, 10);
            if (!Number.isNaN(n)) onChange(Math.min(INF - 1, Math.max(1, n)));
          }} />
      )}
    </div>
  );
}

export default function Super() {
  const nav = useNavigate();
  const [admins, setAdmins] = useState([]);
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState({ email: '', password: '', pageQuota: 5, canEditLibrary: false });
  const [error, setError] = useState('');
  const [editQuota, setEditQuota] = useState(null); // admin being edited
  const [confirmSuspend, setConfirmSuspend] = useState(null);

  const load = () => Promise.all([
    api.get('/admins').then(r => setAdmins(r.data)),
    api.get('/admins/stats').then(r => setStats(r.data)),
  ]);
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function generate() {
    set('password', Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6));
  }

  async function create(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/admins', form);
      setForm({ email: '', password: '', pageQuota: 5, canEditLibrary: false });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create admin');
    }
  }

  async function patch(id, body) {
    await api.patch(`/admins/${id}`, body);
    setEditQuota(null);
    setConfirmSuspend(null);
    load();
  }

  function statusChip(a) {
    if (a.status === 'suspended') return <span className="chip chip-suspended">SUSPENDED</span>;
    if (a.pagesUsed >= a.pageQuota) return <span className="chip chip-atlimit">AT LIMIT</span>;
    return <span className="chip chip-published">ACTIVE</span>;
  }

  function integrationChips(a) {
    return (
      <span style={{ display: 'inline-flex', gap: 5 }}>
        <span className={`chip ${a.allowSheets ? 'chip-published' : 'chip-draft'}`} title="Google Sheets">📊 {a.allowSheets ? 'ON' : 'OFF'}</span>
        <span className={`chip ${a.allowWa ? 'chip-published' : 'chip-draft'}`} title="WhatsApp Cloud API">💬 {a.allowWa ? 'ON' : 'OFF'}</span>
      </span>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-admin)' }}>
      <div className="super-header">
        <span className="title">Super Admin</span>
        <span className="email">{auth.email} · <button style={{ color: '#fff', opacity: .75, textDecoration: 'underline' }} onClick={() => { auth.logout(); nav('/login'); }}>Sign out</button></span>
      </div>
      <div className="super-body">
        {stats && (
          <div className="stat-grid cols-3">
            <div className="stat-card"><div className="label">ADMINS</div><div className="value">{stats.admins}</div></div>
            <div className="stat-card"><div className="label">PUBLISHED PAGES</div><div className="value">{stats.publishedPages}</div></div>
            <div className="stat-card"><div className="label">ENROLLS · 30D</div><div className="value green">{stats.enrolls30d}</div></div>
          </div>
        )}
        <div className="super-cols">
          <div className="super-main">
            <div className="table">
              <div className="table-head" style={{ gridTemplateColumns: '1.8fr .8fr .9fr 1.1fr .9fr' }}>
                <span>Email</span><span>Pages</span><span>Status</span><span>Integrations</span><span style={{ textAlign: 'right' }}>Actions</span>
              </div>
              {admins.map(a => (
                <div className="table-row" style={{ gridTemplateColumns: '1.8fr .8fr .9fr 1.1fr .9fr' }} key={a.id}>
                  <span style={{ fontWeight: 600, color: 'var(--ink-admin)' }}>{a.email}</span>
                  <span className="mono">{a.pagesUsed} / {a.pageQuota >= 9999 ? '∞' : a.pageQuota}</span>
                  <span>{statusChip(a)}</span>
                  <span>{integrationChips(a)}</span>
                  <span style={{ textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => setEditQuota(a)}>Edit</button>
                    {a.status === 'active'
                      ? <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 11, color: 'var(--warn)' }} onClick={() => setConfirmSuspend(a)}>Suspend</button>
                      : <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 11, color: 'var(--accent)' }} onClick={() => patch(a.id, { status: 'active' })}>Reactivate</button>}
                  </span>
                </div>
              ))}
              {admins.length === 0 && <div style={{ padding: 20, fontSize: 12.5, color: 'var(--muted)' }}>No admins yet — create the first one on the right.</div>}
            </div>
          </div>
          <div className="super-rail">
            <div className="card">
              <div className="card-header">Add admin</div>
              <form className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={create}>
                <div><label className="field-label">Email</label>
                  <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="admin@clinic.in" required /></div>
                <div><label className="field-label">Temp password</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="input" value={form.password} onChange={e => set('password', e.target.value)} required />
                    <button type="button" className="btn-ghost" onClick={generate}>Generate</button>
                  </div>
                </div>
                <div><label className="field-label">Page quota</label>
                  <QuotaControl value={form.pageQuota} onChange={v => set('pageQuota', v)} />
                </div>
                <div className="toggle-row" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-admin)' }}>Can edit plan library</div>
                  <button type="button" className={`toggle${form.canEditLibrary ? ' on' : ''}`} onClick={() => set('canEditLibrary', !form.canEditLibrary)}><span className="knob" /></button>
                </div>
                {error && <div className="form-error">{error}</div>}
                <button className="btn-primary" type="submit">Create admin</button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {editQuota && (
        <div className="overlay" onClick={() => setEditQuota(null)}>
          <div className="modal" style={{ width: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head"><div className="modal-title">Edit {editQuota.email}</div></div>
            <div className="modal-body">
              <div><label className="field-label">Page quota</label>
                <QuotaControl key={editQuota.id} value={editQuota.pageQuota}
                  onChange={v => setEditQuota(a => ({ ...a, pageQuota: v }))} />
              </div>
              <div className="toggle-row" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>Can edit plan library</div>
                <button type="button" className={`toggle${editQuota.canEditLibrary ? ' on' : ''}`}
                  onClick={() => setEditQuota(a => ({ ...a, canEditLibrary: !a.canEditLibrary }))}><span className="knob" /></button>
              </div>
              <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 12 }}>
                <label className="field-label" style={{ marginBottom: 8 }}>Integrations this admin may use</label>
                <div className="toggle-row" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>📊 Google Sheets</div>
                  <button type="button" className={`toggle${editQuota.allowSheets ? ' on' : ''}`}
                    onClick={() => setEditQuota(a => ({ ...a, allowSheets: !a.allowSheets }))}><span className="knob" /></button>
                </div>
                <div className="toggle-row" style={{ borderTop: 'none', marginTop: 0, paddingTop: 8 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>💬 WhatsApp Cloud API</div>
                  <button type="button" className={`toggle${editQuota.allowWa ? ' on' : ''}`}
                    onClick={() => setEditQuota(a => ({ ...a, allowWa: !a.allowWa }))}><span className="knob" /></button>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 6, lineHeight: 1.4 }}>
                  Turning one off stops that connection immediately and hides it from the admin's Settings.
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setEditQuota(null)}>Cancel</button>
              <button className="btn-primary" onClick={() => patch(editQuota.id, { pageQuota: editQuota.pageQuota, canEditLibrary: editQuota.canEditLibrary, allowSheets: editQuota.allowSheets, allowWa: editQuota.allowWa })}>Save</button>
            </div>
          </div>
        </div>
      )}

      {confirmSuspend && (
        <div className="overlay" onClick={() => setConfirmSuspend(null)}>
          <div className="modal" style={{ width: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head"><div className="modal-title">Suspend {confirmSuspend.email}?</div></div>
            <div className="modal-body">
              <div style={{ fontSize: 12.5, color: 'var(--warn)', background: '#fff4dd', borderRadius: 9, padding: '10px 12px', lineHeight: 1.5 }}>
                They won't be able to sign in. Their published pages stay live.
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setConfirmSuspend(null)}>Cancel</button>
              <button className="btn-primary" style={{ background: 'var(--warn)' }} onClick={() => patch(confirmSuspend.id, { status: 'suspended' })}>Suspend</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
