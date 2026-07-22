import { useState } from 'react';
import { api } from '../api.js';

const ICONS = ['🤰', '🌿', '💜', '🩸', '🫁', '⚖️', '🧠', '❤️', '🦴', '🧘'];

export default function PlanModal({ plan, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: plan?.title || '', icon: plan?.icon || '🌿', subtitle: plan?.subtitle || '',
    description: plan?.description || '',
    features: [...(plan?.features || []), '', '', '', '', '', ''].slice(0, 6),
    tags: plan?.tags || [], watermarkUrl: plan?.watermarkUrl || '',
  });
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function addTag() {
    const t = tagInput.trim();
    if (t && form.tags.length < 3) set('tags', [...form.tags, t]);
    setTagInput('');
  }

  async function save() {
    setError('');
    const body = { ...form, features: form.features.filter(Boolean) };
    try {
      if (plan?._id) await api.patch(`/plans/${plan._id}`, body);
      else await api.post('/plans', body);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save plan');
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><div className="modal-title">{plan?._id ? 'Edit plan' : 'New plan'}</div></div>
        <div className="modal-body">
          <div><label className="field-label">Icon</label>
            <div className="icon-picker">
              {ICONS.map(ic => <button key={ic} className={`icon-opt${form.icon === ic ? ' active' : ''}`} onClick={() => set('icon', ic)}>{ic}</button>)}
            </div>
          </div>
          <div className="form-grid-2">
            <div><label className="field-label">Plan name</label>
              <input className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Pregnancy Care" /></div>
            <div><label className="field-label">Card subtitle</label>
              <input className="input" value={form.subtitle} onChange={e => set('subtitle', e.target.value)} placeholder="Conception to postpartum" /></div>
          </div>
          <div><label className="field-label">Short description</label>
            <textarea className="input" rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></div>
          <div><label className="field-label">Features (exactly 6 shown on the card)</label>
            <div className="form-grid-2" style={{ gap: 8 }}>
              {form.features.map((f, i) => (
                <input key={i} className="input" value={f} placeholder={`Feature ${i + 1}`}
                  onChange={e => set('features', form.features.map((x, xi) => xi === i ? e.target.value : x))} />
              ))}
            </div>
          </div>
          <div><label className="field-label">Expert tags (up to 3)</label>
            <div className="tag-chips" style={{ marginBottom: 7 }}>
              {form.tags.map((t, i) => (
                <span className="tag-chip" key={i}>{t}<button onClick={() => set('tags', form.tags.filter((_, xi) => xi !== i))}>×</button></span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="Nutritionist" disabled={form.tags.length >= 3} />
              <button className="btn-ghost" onClick={addTag} disabled={form.tags.length >= 3}>Add</button>
            </div>
          </div>
          <div><label className="field-label">Watermark photo link</label>
            <input className="input" value={form.watermarkUrl} onChange={e => set('watermarkUrl', e.target.value)} placeholder="https://…/photo.jpg" />
            <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4 }}>Shows at the card's bottom-right corner at 16% opacity. Empty = the plan icon is used instead.</div>
            {form.watermarkUrl && (
              <div style={{ marginTop: 8, position: 'relative', width: 150, height: 90, border: '1px solid var(--divider)', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                <img src={form.watermarkUrl} alt="watermark preview"
                  style={{ position: 'absolute', right: 0, bottom: 0, width: '58%', height: '78%', objectFit: 'cover', opacity: .16 }}
                  onError={e => { e.target.style.outline = '2px solid var(--danger)'; e.target.alt = '⚠︎'; }} />
                <span style={{ position: 'absolute', left: 8, top: 8, fontSize: 9.5, color: 'var(--muted)' }}>card preview</span>
              </div>
            )}
          </div>
          {error && <div className="form-error">{error}</div>}
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={!form.title}>Save plan</button>
        </div>
      </div>
    </div>
  );
}
