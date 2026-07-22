import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { api } from '../api.js';
import AdminLayout from '../components/AdminLayout.jsx';

function NewPageWizard({ onClose, onCreated, remaining }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ doctorName: '', specialty: '', waNumber: '', slug: '', template: 'green-grid' });
  const [slugState, setSlugState] = useState(null);
  const [plans, setPlans] = useState([]);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { api.get('/plans').then(r => setPlans(r.data)); }, []);

  useEffect(() => {
    if (!form.slug) { setSlugState(null); return; }
    const t = setTimeout(() => {
      api.get('/pages/check-slug', { params: { slug: form.slug } }).then(r => setSlugState(r.data));
    }, 400);
    return () => clearTimeout(t);
  }, [form.slug]);

  function toggle(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : (s.length < 12 ? [...s, id] : s));
  }

  async function create() {
    setError('');
    try {
      const { data } = await api.post('/pages', { ...form, planIds: selected });
      onCreated(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create page');
    }
  }

  const templates = [['green-grid', 'Green Grid'], ['classic-list', 'Classic List'], ['bold-dark', 'Bold Dark']];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">New page</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Step {step} of 3 · Doctor → Plans → Publish</div>
        </div>
        <div className="modal-body">
          {step === 1 && <>
            <div className="form-grid-2">
              <div><label className="field-label">Doctor name</label>
                <input className="input" value={form.doctorName} onChange={e => set('doctorName', e.target.value)} placeholder="Dr. Lekshmi Narendran" /></div>
              <div><label className="field-label">Specialty</label>
                <input className="input" value={form.specialty} onChange={e => set('specialty', e.target.value)} placeholder="Obstetrics & Gynaecology" /></div>
            </div>
            <div className="form-grid-2">
              <div><label className="field-label">WhatsApp number</label>
                <input className="input" value={form.waNumber} onChange={e => set('waNumber', e.target.value)} placeholder="919876543210" /></div>
              <div><label className="field-label">Page slug</label>
                <input className="input" value={form.slug} onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="dr-lekshmi" />
                {slugState && <div className={`slug-check ${slugState.available ? 'ok' : 'bad'}`}>
                  {slugState.available ? '✓ available' : slugState.reason === 'invalid' ? 'Use kebab-case: letters, numbers, dashes' : '✗ taken'}</div>}
              </div>
            </div>
            <div>
              <label className="field-label">Template</label>
              <div className="template-picker">
                {templates.map(([id, label]) => (
                  <div key={id} className={`template-opt${form.template === id ? ' active' : ''}`} onClick={() => set('template', id)}>
                    <div className={`thumb${id === 'bold-dark' ? ' dark' : ''}`} />{label}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{remaining} page{remaining === 1 ? '' : 's'} left in your quota.</div>
          </>}
          {step === 2 && <>
            <div style={{ fontSize: 12, color: 'var(--secondary-admin)' }}>Pick up to 12 plans from the library ({selected.length}/12 selected).</div>
            {plans.map(p => (
              <label key={p._id} className="planrow" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={selected.includes(p._id)} onChange={() => toggle(p._id)} />
                <span className="icon">{p.icon}</span>
                <div className="info"><div className="name">{p.title}</div><div className="meta">{p.subtitle}</div></div>
              </label>
            ))}
          </>}
          {step === 3 && <>
            <div style={{ fontSize: 13, color: 'var(--body)', lineHeight: 1.6 }}>
              <b>{form.doctorName || 'Untitled'}</b> · /p/{form.slug || '—'}<br />
              {selected.length} plan{selected.length === 1 ? '' : 's'} · template: {form.template}<br />
              The page is created as a <b>draft</b> — publish it from the editor when it's ready.
            </div>
            {error && <div className="form-error">{error}</div>}
          </>}
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={step === 1 ? onClose : () => setStep(s => s - 1)}>{step === 1 ? 'Cancel' : 'Back'}</button>
          {step < 3
            ? <button className="btn-primary" disabled={step === 1 && (!form.doctorName || !form.slug || slugState?.available === false)} onClick={() => setStep(s => s + 1)}>Next</button>
            : <button className="btn-primary" onClick={create}>Create draft</button>}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [wizard, setWizard] = useState(false);
  const [copied, setCopied] = useState(null);

  const load = () => api.get('/pages').then(r => setData(r.data));
  useEffect(() => { load(); }, []);

  const remaining = useMemo(() => data ? Math.max(0, data.quota - data.used) : 0, [data]);

  async function publish(page) {
    await api.post(`/pages/${page._id}/publish`, { status: page.status === 'published' ? 'draft' : 'published' });
    load();
  }

  function copyLink(page) {
    navigator.clipboard.writeText(`${location.origin}/p/${page.slug}`);
    setCopied(page._id);
    setTimeout(() => setCopied(null), 1500);
  }

  async function downloadQr(page) {
    const url = await QRCode.toDataURL(`${location.origin}/p/${page.slug}`, { margin: 1, width: 512 });
    const a = Object.assign(document.createElement('a'), { href: url, download: `${page.slug}-qr.png` });
    a.click();
  }

  return (
    <AdminLayout>
      <div className="page-head">
        <div>
          <div className="page-title">Pages</div>
          {data && <div className="page-sub">{data.used} of {data.quota} pages used</div>}
        </div>
        <button className="btn-primary" onClick={() => setWizard(true)} disabled={remaining === 0}>+ New page</button>
      </div>

      {data && data.pages.length === 0 && (
        <div className="empty-state">
          <div className="icontile">📄</div>
          <div className="msg">Create your first doctor page — pick plans from the library and share the WhatsApp link.</div>
          <button className="btn-primary" onClick={() => setWizard(true)}>+ Create first page</button>
        </div>
      )}

      {data && data.pages.length > 0 && (
        <div className="pages-grid">
          {data.pages.map(page => (
            <div className="pagecard" key={page._id}>
              <div className="preview-strip">
                <div style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 7, letterSpacing: '.18em', color: page.accentColor, fontWeight: 700, textTransform: 'uppercase' }}>{page.doctorName}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-patient)', margin: '2px 0 6px' }}>{page.heroHeadline}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                    {(page.planIds || []).slice(0, 6).map(p => (
                      <div key={p._id} style={{ background: '#fff', border: '1px solid var(--border-patient)', borderRadius: 5, padding: '4px 2px', fontSize: 9 }}>{p.icon}</div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="body">
                <div className="titlerow">
                  <span className="doctor">{page.doctorName}</span>
                  <span className={`chip ${page.status === 'published' ? 'chip-published' : 'chip-draft'}`}>{page.status.toUpperCase()}</span>
                </div>
                <span className="slug">/p/{page.slug}</span>
                <div className="stats">
                  <span><b>{(page.planIds || []).length}</b> plans</span>
                  <span><b>{page.stats?.views ?? 0}</b> views</span>
                  <span><b>{page.stats?.enrollClicks ?? 0}</b> enrolls</span>
                </div>
                <div className="actions">
                  <button className="btn-ghost" onClick={() => nav(`/pages/${page._id}`)}>Edit</button>
                  {page.status === 'published' ? <>
                    <button className="btn-ghost" onClick={() => copyLink(page)}>{copied === page._id ? 'Copied ✓' : 'Copy link'}</button>
                    <button className="btn-ghost" onClick={() => downloadQr(page)}>QR</button>
                  </> : <button className="btn-secondary" onClick={() => publish(page)}>Publish</button>}
                </div>
              </div>
            </div>
          ))}
          {remaining > 0 && (
            <button className="newcard" onClick={() => setWizard(true)}>
              <div className="plus">+</div>
              Create new page · {remaining} left in quota
            </button>
          )}
        </div>
      )}

      {wizard && <NewPageWizard remaining={remaining} onClose={() => setWizard(false)}
        onCreated={page => { setWizard(false); nav(`/pages/${page._id}`); }} />}
    </AdminLayout>
  );
}
