import { useEffect, useState } from 'react';
import { api } from '../api.js';
import AdminLayout from '../components/AdminLayout.jsx';
import PlanModal from '../components/PlanModal.jsx';

export default function PlanLibrary() {
  const [plans, setPlans] = useState([]);
  const [modal, setModal] = useState(null); // null | 'new' | plan object
  const [error, setError] = useState('');

  const load = () => api.get('/plans').then(r => setPlans(r.data));
  useEffect(() => { load(); }, []);

  async function duplicate(plan) {
    setError('');
    try {
      await api.post('/plans', {
        title: `${plan.title} (copy)`, icon: plan.icon, subtitle: plan.subtitle,
        description: plan.description, features: plan.features, tags: plan.tags, watermarkUrl: plan.watermarkUrl,
      });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not duplicate');
    }
  }

  return (
    <AdminLayout>
      <div className="page-head">
        <div>
          <div className="page-title">Plan Library</div>
          <div className="page-sub">Reusable plans you can drop onto any page</div>
        </div>
        <button className="btn-primary" onClick={() => setModal('new')}>+ New plan</button>
      </div>
      {error && <div className="form-error" style={{ marginBottom: 10 }}>{error}</div>}
      <div className="library-grid">
        {plans.map(p => (
          <div className="plancard-lib" key={p._id}>
            <div className="head">
              <span className="icon">{p.icon}</span>
              <div>
                <div className="title">{p.title}</div>
                <div className="usage">Used on {p.usageCount} page{p.usageCount === 1 ? '' : 's'}</div>
              </div>
            </div>
            <div className="desc">{p.description}</div>
            <div className="tags">{p.tags.map((t, i) => <span className="tag" key={i}>{t}</span>)}</div>
            <div className="actions">
              <button className="btn-ghost" onClick={() => setModal(p)}>Edit</button>
              <button className="btn-ghost" onClick={() => duplicate(p)}>Duplicate</button>
            </div>
          </div>
        ))}
        <button className="newcard" onClick={() => setModal('new')}>
          <div className="plus">+</div>New plan
        </button>
      </div>
      {modal && <PlanModal plan={modal === 'new' ? null : modal} onClose={() => setModal(null)}
        onSaved={() => { setModal(null); load(); }} />}
    </AdminLayout>
  );
}
