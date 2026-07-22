import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, waLink } from '../api.js';
import PlanGrid from '../components/PlanGrid.jsx';

function EnrollSheet({ page, plan, onClose }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const message = `Hi, I'm ${name || '…'}. I'm interested in the ${plan.title} plan at ${page.doctorName}. Please share more details.`;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/leads', { name, phone, planId: plan.id, pageId: page.id });
    } catch { /* still continue to WhatsApp — losing the lead shouldn't block the patient */ }
    const url = waLink(page.waNumber, "Hi, I'm {name}. I'm interested in the {plan} plan at {doctor}. Please share more details.",
      { name, plan: plan.title, doctor: page.doctorName });
    window.location.href = url;
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="handle" />
        <div className="plan-row"><span className="icon">{plan.icon}</span><div className="name">{plan.title}</div></div>
        <div className="explainer">Share your details — we'll continue on WhatsApp with {page.doctorName}'s team.</div>
        <form onSubmit={submit}>
          <div>
            <label className="field-label">Your name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Anita Sharma" required />
          </div>
          <div>
            <label className="field-label">WhatsApp number</label>
            <input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98XXXXXX21" required />
          </div>
          <div className="preview">Message preview: "Hi, I'm {name || '…'}. I'm interested in the <b>{plan.title}</b> plan at <b>{page.doctorName}</b>. Please share more details."</div>
          <button className="cta" disabled={busy}>Continue to WhatsApp ›</button>
          <div className="privacy">Your details are shared only with this clinic.</div>
        </form>
      </div>
    </div>
  );
}

export default function PatientPage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [sheetPlan, setSheetPlan] = useState(null);
  const viewFired = useRef(false);

  useEffect(() => {
    api.get(`/public/${slug}`)
      .then(r => {
        setPage(r.data);
        const key = `viewed-${r.data.id}`;
        if (!viewFired.current && !sessionStorage.getItem(key)) {
          viewFired.current = true;
          sessionStorage.setItem(key, '1');
          api.post('/track', { pageId: r.data.id, type: 'view' }).catch(() => {});
        }
      })
      .catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) return (
    <div className="p404">
      <div className="emoji">🌱</div>
      <h1>This page isn't available</h1>
      <p>The link may be wrong, or the page hasn't been published yet.</p>
      <a className="btn-secondary" href="mailto:support@mamily.in">Contact support</a>
    </div>
  );
  if (!page) return <div className="p404"><p>Loading…</p></div>;

  function enroll(plan) {
    api.post('/track', { pageId: page.id, planId: plan.id, type: 'enroll_click' }).catch(() => {});
    if (page.leadCapture) {
      setSheetPlan(plan);
    } else {
      window.location.href = waLink(page.waNumber, page.waTemplate, { plan: plan.title, doctor: page.doctorName });
    }
  }

  return (
    <div className={`patient tpl-${page.template || 'green-grid'}`}>
      <PlanGrid page={page} plans={page.plans} onEnroll={enroll} />
      {sheetPlan && <EnrollSheet page={page} plan={sheetPlan} onClose={() => setSheetPlan(null)} />}
    </div>
  );
}
