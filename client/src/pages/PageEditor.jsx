import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { api } from '../api.js';
import PlanGrid from '../components/PlanGrid.jsx';
import PlanModal from '../components/PlanModal.jsx';

const SWATCHES = ['#2f7a4e', '#1f5c8a', '#7a2f5e', '#8a5a1f', '#1c2b22'];
const TEMPLATES = [['green-grid', 'Green Grid'], ['classic-list', 'Classic List'], ['bold-dark', 'Bold Dark']];
const MAX_PLANS = 12;

export default function PageEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const [page, setPage] = useState(null);
  const [library, setLibrary] = useState([]);
  const [saved, setSaved] = useState('Saved');
  const [device, setDevice] = useState('mobile');
  const [slugState, setSlugState] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [qr, setQr] = useState('');
  const saveTimer = useRef(null);
  const firstLoad = useRef(true);

  useEffect(() => {
    api.get(`/pages/${id}`).then(r => setPage(r.data)).catch(() => nav('/dashboard'));
    api.get('/plans').then(r => setLibrary(r.data));
  }, [id]);

  const liveUrl = page ? `${location.origin}/p/${page.slug}` : '';
  useEffect(() => { if (liveUrl) QRCode.toDataURL(liveUrl, { margin: 1, width: 168 }).then(setQr); }, [liveUrl]);

  // debounced autosave
  const set = useCallback(patch => {
    setPage(p => ({ ...p, ...patch }));
    setSaved('Saving…');
  }, []);

  useEffect(() => {
    if (!page) return;
    if (firstLoad.current) { firstLoad.current = false; return; }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.patch(`/pages/${id}`, {
          slug: page.slug, doctorName: page.doctorName, specialty: page.specialty,
          waNumber: page.waNumber, heroHeadline: page.heroHeadline, heroSub: page.heroSub,
          brandName: page.brandName, headerRightText: page.headerRightText,
          footerText: page.footerText, template: page.template,
          accentColor: page.accentColor, logoUrl: page.logoUrl,
          planIds: page.planIds.map(p => p._id || p),
          waTemplate: page.waTemplate, leadCapture: page.leadCapture,
        });
        setPage(p => ({ ...p, planIds: data.planIds, status: data.status }));
        setSaved('Saved just now');
      } catch (err) {
        setSaved(err.response?.data?.error || 'Save failed');
      }
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [page && JSON.stringify({ ...page, planIds: page.planIds.map(p => p._id || p), stats: null })]);

  // debounced slug availability
  useEffect(() => {
    if (!page?.slug) return;
    const t = setTimeout(() => {
      api.get('/pages/check-slug', { params: { slug: page.slug, excludeId: id } }).then(r => setSlugState(r.data));
    }, 400);
    return () => clearTimeout(t);
  }, [page?.slug]);

  const previewPage = useMemo(() => page && ({
    ...page, id: page._id,
  }), [page]);
  const previewPlans = useMemo(() => (page?.planIds || []).map(p => ({ ...p, id: p._id })), [page]);

  if (!page) return null;

  async function togglePublish() {
    const { data } = await api.post(`/pages/${id}/publish`, { status: page.status === 'published' ? 'draft' : 'published' });
    setPage(p => ({ ...p, status: data.status }));
  }

  async function remove() {
    await api.delete(`/pages/${id}`);
    nav('/dashboard');
  }

  function movePlan(i, dir) {
    const arr = [...page.planIds];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    set({ planIds: arr });
  }

  const inPage = new Set(page.planIds.map(p => p._id));
  const waPreview = (page.waTemplate || '').replaceAll('{plan}', page.planIds[0]?.title || 'Pregnancy Care').replaceAll('{doctor}', page.doctorName);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-admin)', padding: '18px 24px' }}>
      <div className="editor-topbar">
        <Link className="back" to="/dashboard">‹ Back</Link>
        <span className="pagename">{page.doctorName}</span>
        <span className={`chip ${page.status === 'published' ? 'chip-published' : 'chip-draft'}`}>{page.status.toUpperCase()}</span>
        <span className="saved">{saved}</span>
        <span className="spacer" />
        <button className="btn-ghost" onClick={togglePublish}>{page.status === 'published' ? 'Unpublish' : 'Publish'}</button>
        {page.status === 'published' && <a className="btn-secondary" href={liveUrl} target="_blank" rel="noreferrer">View live ↗</a>}
        <button className="btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete(true)}>Delete</button>
      </div>

      <div className="editor-cols">
        <div className="editor-forms">
          <div className="card">
            <div className="card-header">Doctor &amp; clinic</div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-grid-2">
                <div><label className="field-label">Doctor name</label>
                  <input className="input" value={page.doctorName} onChange={e => set({ doctorName: e.target.value })} /></div>
                <div><label className="field-label">Specialty</label>
                  <input className="input" value={page.specialty} onChange={e => set({ specialty: e.target.value })} /></div>
              </div>
              <div className="form-grid-2">
                <div><label className="field-label">Page slug</label>
                  <input className="input" value={page.slug} onChange={e => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} />
                  {slugState && <div className={`slug-check ${slugState.available ? 'ok' : 'bad'}`}>{slugState.available ? '✓ available' : '✗ not available'}</div>}
                </div>
                <div><label className="field-label">WhatsApp number</label>
                  <input className="input" value={page.waNumber} onChange={e => set({ waNumber: e.target.value })} placeholder="919876543210" /></div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">Brand</div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="field-label">Accent color</label>
                <div className="swatches">
                  {SWATCHES.map(c => (
                    <button key={c} className={`swatch${page.accentColor === c ? ' active' : ''}`} style={{ background: c }} onClick={() => set({ accentColor: c })} />
                  ))}
                </div>
              </div>
              <div className="form-grid-2">
                <div><label className="field-label">Brand name (header left)</label>
                  <input className="input" value={page.brandName} onChange={e => set({ brandName: e.target.value })} />
                  <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4 }}>Without a logo, the tile shows this name's first letter.</div></div>
                <div><label className="field-label">Header right text</label>
                  <input className="input" value={page.headerRightText ?? ''} onChange={e => set({ headerRightText: e.target.value })} placeholder="Leave empty to hide" /></div>
              </div>
              <div><label className="field-label">Logo URL (optional)</label>
                <input className="input" value={page.logoUrl} onChange={e => set({ logoUrl: e.target.value })} placeholder="https://…" /></div>
              <div><label className="field-label">Template</label>
                <div className="template-picker">
                  {TEMPLATES.map(([tid, label]) => (
                    <div key={tid} className={`template-opt${page.template === tid ? ' active' : ''}`} onClick={() => set({ template: tid })}>
                      <div className={`thumb${tid === 'bold-dark' ? ' dark' : ''}`} />{label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">Plans on this page ({page.planIds.length}/{MAX_PLANS})</div>
            <div className="card-pad">
              {page.planIds.map((p, i) => (
                <div className="planrow" key={p._id}>
                  <span className="drag">⋮⋮</span>
                  <span className="icon">{p.icon}</span>
                  <div className="info">
                    <div className="name">{p.title}</div>
                    <div className="meta">{p.subtitle}{p.watermarkUrl ? ' · 🖼 watermark' : ''}</div>
                  </div>
                  <button onClick={() => movePlan(i, -1)} disabled={i === 0}>↑</button>
                  <button onClick={() => movePlan(i, 1)} disabled={i === page.planIds.length - 1}>↓</button>
                  <button onClick={() => setEditPlan(p)}>Edit</button>
                  <button onClick={() => set({ planIds: page.planIds.filter(x => x._id !== p._id) })}>Remove</button>
                </div>
              ))}
              {page.planIds.length < MAX_PLANS && (
                <button className="btn-secondary" style={{ marginTop: 10 }} onClick={() => setAddOpen(o => !o)}>+ Add from library</button>
              )}
              {addOpen && (
                <div style={{ marginTop: 10, borderTop: '1px solid var(--divider)' }}>
                  {library.filter(p => !inPage.has(p._id)).map(p => (
                    <div className="planrow" key={p._id}>
                      <span className="icon">{p.icon}</span>
                      <div className="info"><div className="name">{p.title}</div><div className="meta">Used on {p.usageCount} page{p.usageCount === 1 ? '' : 's'}</div></div>
                      <button onClick={() => { if (page.planIds.length < MAX_PLANS) set({ planIds: [...page.planIds, p] }); }}>Add</button>
                    </div>
                  ))}
                  {library.filter(p => !inPage.has(p._id)).length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', padding: '10px 0' }}>All library plans are already on this page.</div>}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">WhatsApp message template</div>
            <div className="card-pad">
              <div style={{ marginBottom: 7 }}>
                <span className="token-chip">{'{plan}'}</span>
                <span className="token-chip">{'{doctor}'}</span>
                <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>tokens are filled automatically</span>
              </div>
              <textarea className="input" rows={2} value={page.waTemplate} onChange={e => set({ waTemplate: e.target.value })} />
              <div className="wa-preview">Preview: "{waPreview}"</div>
              <div className="toggle-row">
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-admin)' }}>Lead capture</div>
                  <div className="desc">{page.leadCapture
                    ? 'ON — patients fill a short sheet before WhatsApp opens; details are saved to Leads.'
                    : 'OFF — the Enroll button opens WhatsApp directly.'}</div>
                </div>
                <button className={`toggle${page.leadCapture ? ' on' : ''}`} onClick={() => set({ leadCapture: !page.leadCapture })}><span className="knob" /></button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">Header &amp; footer text</div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="field-label">Hero headline</label>
                <input className="input" value={page.heroHeadline} onChange={e => set({ heroHeadline: e.target.value })} /></div>
              <div><label className="field-label">Hero subtitle</label>
                <input className="input" value={page.heroSub} onChange={e => set({ heroSub: e.target.value })} /></div>
              <div><label className="field-label">Footer text</label>
                <input className="input" value={page.footerText} onChange={e => set({ footerText: e.target.value })} /></div>
            </div>
          </div>
        </div>

        <div className="editor-rail">
          <div className="device-toggle">
            <button className={device === 'mobile' ? 'active' : ''} onClick={() => setDevice('mobile')}>Mobile</button>
            <button className={device === 'desktop' ? 'active' : ''} onClick={() => setDevice('desktop')}>Desktop</button>
          </div>
          <div className="phone-frame" style={{ height: device === 'mobile' ? 560 : 300, overflow: 'hidden' }}>
            <div className={`phone-scale patient tpl-${page.template || 'green-grid'}`} style={device === 'mobile'
              ? { width: 390, transform: 'scale(0.8146)', minHeight: 687 }
              : { width: 1160, transform: 'scale(0.2739)', minHeight: 1095 }}>
              <PlanGrid page={previewPage} plans={previewPlans} />
            </div>
          </div>
          <div className="card card-pad">
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 9 }}>Share</div>
            <div className="share-qr">
              {qr && <img src={qr} alt="QR code" />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
                <span className="share-link">{liveUrl}</span>
                <button className="btn-ghost" onClick={() => navigator.clipboard.writeText(liveUrl)}>Copy link</button>
                {qr && <a className="btn-ghost" style={{ textAlign: 'center' }} href={qr} download={`${page.slug}-qr.png`}>Download QR</a>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {editPlan && (
        <PlanModal plan={editPlan} onClose={() => setEditPlan(null)}
          onSaved={async () => {
            setEditPlan(null);
            const [{ data: fresh }, { data: lib }] = await Promise.all([api.get(`/pages/${id}`), api.get('/plans')]);
            setPage(p => ({ ...p, planIds: fresh.planIds }));
            setLibrary(lib);
          }} />
      )}

      {confirmDelete && (
        <div className="overlay" onClick={() => setConfirmDelete(false)}>
          <div className="modal" style={{ width: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head"><div className="modal-title">Delete this page?</div></div>
            <div className="modal-body">
              <div style={{ fontSize: 12.5, color: 'var(--body)', lineHeight: 1.6 }}>
                <b>/p/{page.slug}</b> will stop working immediately. Captured leads are kept.
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="btn-danger" onClick={remove}>Delete page</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
