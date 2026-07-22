import { useEffect, useState } from 'react';
import { api } from '../api.js';
import AdminLayout from '../components/AdminLayout.jsx';

function delta(cur, prev) {
  if (!prev) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  return pct === 0 ? null : `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}%`;
}

export default function Analytics() {
  const [range, setRange] = useState(30);
  const [data, setData] = useState(null);

  useEffect(() => { api.get('/analytics', { params: { range } }).then(r => setData(r.data)); }, [range]);

  const maxViews = data ? Math.max(1, ...data.weekly.map(w => w.views)) : 1;

  return (
    <AdminLayout>
      <div className="page-head">
        <div>
          <div className="page-title">Analytics</div>
          <div className="page-sub">Page views and enroll clicks across your pages</div>
        </div>
        <div className="range-toggle">
          {[30, 90].map(r => (
            <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{r} days</button>
          ))}
        </div>
      </div>

      {data && <>
        <div className="stat-grid cols-3">
          <div className="stat-card"><div className="label">PAGE VIEWS</div>
            <div className="value">{data.views}{delta(data.views, data.prev.views) && <span className="delta">{delta(data.views, data.prev.views)}</span>}</div></div>
          <div className="stat-card"><div className="label">ENROLL CLICKS</div>
            <div className="value green">{data.enrolls}{delta(data.enrolls, data.prev.enrolls) && <span className="delta">{delta(data.enrolls, data.prev.enrolls)}</span>}</div></div>
          <div className="stat-card"><div className="label">CLICK-THROUGH RATE</div>
            <div className="value">{data.ctr}%</div></div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">Weekly activity</div>
          <div className="card-pad">
            <div className="barchart">
              {data.weekly.map((w, i) => (
                <div className="bargroup" key={i}>
                  <div className="bars-pair">
                    <div className="bar light" style={{ height: `${(w.views / maxViews) * 100}%` }} title={`${w.views} views`} />
                    <div className="bar" style={{ height: `${(w.enrolls / maxViews) * 100}%` }} title={`${w.enrolls} enrolls`} />
                  </div>
                  <span className="barlabel">{w.label}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 10.5, color: 'var(--muted)', marginTop: 8 }}>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, background: 'var(--accent-tint-dk)', borderRadius: 2, marginRight: 5 }} />Views</span>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, background: 'var(--accent)', borderRadius: 2, marginRight: 5 }} />Enroll clicks</span>
            </div>
          </div>
        </div>

        <div className="table">
          <div className="table-head" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
            <span>Plan</span><span>Views</span><span>Enrolls</span><span>CTR</span>
          </div>
          {data.perPlan.map(p => (
            <div className="table-row" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }} key={p.planId}>
              <span style={{ fontWeight: 600, color: 'var(--ink-admin)' }}>{p.icon} {p.title}</span>
              <span>{p.views}</span>
              <span>{p.enrolls}</span>
              <span>{p.ctr}%</span>
            </div>
          ))}
        </div>
      </>}
    </AdminLayout>
  );
}
