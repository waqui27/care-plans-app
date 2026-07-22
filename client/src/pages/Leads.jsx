import { useEffect, useState } from 'react';
import { api, timeAgo } from '../api.js';
import AdminLayout from '../components/AdminLayout.jsx';

const STATUSES = ['new', 'contacted', 'enrolled', 'closed'];
const chipClass = { new: 'chip-new', contacted: 'chip-contacted', enrolled: 'chip-enrolled', closed: 'chip-closed' };

function LeadDetail({ lead, onClose, onChanged }) {
  const [note, setNote] = useState('');
  const initials = lead.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

  async function setStatus(status) {
    const { data } = await api.patch(`/leads/${lead._id}`, { status });
    onChanged(data);
  }

  async function addNote(e) {
    e.preventDefault();
    if (!note.trim()) return;
    const { data } = await api.patch(`/leads/${lead._id}`, { note: note.trim() });
    setNote('');
    onChanged(data);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-body" style={{ paddingTop: 22 }}>
          <div className="lead-detail-head">
            <div className="lead-avatar">{initials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-admin)' }}>{lead.name}</div>
              <div className="mono">{lead.phone}</div>
            </div>
            <a className="btn-secondary" href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer">💬 Open chat</a>
          </div>
          <div className="lead-tiles">
            <div className="lead-tile"><div className="label">PLAN</div><div className="val">{lead.planId ? `${lead.planId.icon} ${lead.planId.title}` : '—'}</div></div>
            <div className="lead-tile"><div className="label">SOURCE PAGE</div><div className="val">{lead.pageId ? `/p/${lead.pageId.slug}` : '—'}</div></div>
          </div>
          <div>
            <label className="field-label">Status</label>
            <div className="status-pills">
              {STATUSES.map(s => (
                <button key={s} className={`status-pill${lead.status === s ? ' active' : ''}`} onClick={() => setStatus(s)}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="field-label">Notes</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 9 }}>
              {(lead.notes || []).length === 0 && <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>No notes yet.</div>}
              {(lead.notes || []).map((n, i) => (
                <div className="note" key={i}>{n.text}<div className="meta">{n.author} · {timeAgo(n.at)}</div></div>
              ))}
            </div>
            <form onSubmit={addNote} style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note…" />
              <button className="btn-primary" type="submit">Add</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Leads() {
  const [data, setData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [filterPlan, setFilterPlan] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [detail, setDetail] = useState(null);

  const load = () => api.get('/leads', { params: { plan: filterPlan || undefined, status: filterStatus || undefined } }).then(r => setData(r.data));
  useEffect(() => { load(); }, [filterPlan, filterStatus]);
  useEffect(() => { api.get('/plans').then(r => setPlans(r.data)); }, []);

  async function exportCsv() {
    const res = await api.get('/leads/export', {
      params: { plan: filterPlan || undefined, status: filterStatus || undefined },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = Object.assign(document.createElement('a'), { href: url, download: 'leads.csv' });
    a.click();
    URL.revokeObjectURL(url);
  }

  const cols = '1.4fr 1.2fr 1.2fr 1fr .9fr .9fr';

  return (
    <AdminLayout>
      <div className="page-head">
        <div>
          <div className="page-title">Leads</div>
          <div className="page-sub">Patients who enrolled via WhatsApp on your pages</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="input" style={{ width: 'auto' }} value={filterPlan} onChange={e => setFilterPlan(e.target.value)}>
            <option value="">All plans</option>
            {plans.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
          </select>
          <select className="input" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn-ghost" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      {data && <>
        <div className="stat-grid">
          <div className="stat-card"><div className="label">TOTAL LEADS</div><div className="value">{data.stats.total}</div></div>
          <div className="stat-card"><div className="label">NEW THIS WEEK</div><div className="value green">{data.stats.newThisWeek}</div></div>
          <div className="stat-card"><div className="label">CONTACTED</div><div className="value">{data.stats.contacted}</div></div>
          <div className="stat-card"><div className="label">ENROLLED</div><div className="value">{data.stats.enrolled}</div></div>
        </div>

        {data.leads.length === 0 ? (
          <div className="empty-state">
            <div className="icontile">📥</div>
            <div className="msg">No leads yet. Share a published page — every enroll-sheet submission lands here.</div>
          </div>
        ) : (
          <div className="table">
            <div className="table-head" style={{ gridTemplateColumns: cols }}>
              <span>Patient</span><span>WhatsApp</span><span>Plan</span><span>Page</span><span>When</span><span style={{ textAlign: 'right' }}>Status</span>
            </div>
            {data.leads.map(l => (
              <div className="table-row clickable" style={{ gridTemplateColumns: cols }} key={l._id} onClick={() => setDetail(l)}>
                <span style={{ fontWeight: 600, color: 'var(--ink-admin)' }}>{l.name}</span>
                <span className="mono">{l.phone}</span>
                <span>{l.planId ? `${l.planId.icon} ${l.planId.title}` : '—'}</span>
                <span style={{ color: 'var(--muted)', fontSize: 11.5 }}>{l.pageId?.slug || '—'}</span>
                <span style={{ color: 'var(--muted)', fontSize: 11.5 }}>{timeAgo(l.createdAt)}</span>
                <span style={{ textAlign: 'right' }}><span className={`chip ${chipClass[l.status]}`}>{l.status.toUpperCase()}</span></span>
              </div>
            ))}
          </div>
        )}
        <div className="hint-box">Leads are captured when the patient fills the enroll sheet. Upgrade path: connect WhatsApp Business Cloud API to log incoming messages automatically.</div>
      </>}

      {detail && <LeadDetail lead={detail} onClose={() => setDetail(null)}
        onChanged={updated => { setDetail(updated); load(); }} />}
    </AdminLayout>
  );
}
