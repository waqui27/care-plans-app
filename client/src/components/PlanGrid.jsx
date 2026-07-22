// Shared patient-facing plan grid — used by the live patient page and the editor's phone preview.
export default function PlanGrid({ page, plans, onEnroll, popularIndex = 0 }) {
  return (
    <>
      <header className="patient-header">
        <div className="brand">
          {page.logoUrl
            ? <img src={page.logoUrl} alt="" style={{ width: 24, height: 24, borderRadius: 8, objectFit: 'cover' }} />
            : <div className="logo" style={{ background: page.accentColor }}>{(page.brandName || 'M')[0].toUpperCase()}</div>}
          <span className="name">{page.brandName || 'Mamily Care'}</span>
        </div>
        {page.headerRightText ? <span className="right">{page.headerRightText}</span> : <span />}
      </header>
      <div className="patient-hero">
        <div className="doctor" style={{ color: page.accentColor }}>{page.doctorName}</div>
        <h1>{page.heroHeadline || 'Choose your care plan'}</h1>
        <p>{page.heroSub || 'Expert-led programs · enroll in one tap on WhatsApp'}</p>
      </div>
      <div className="plan-grid">
        {plans.map((plan, i) => (
          <div className="plan-card" key={plan.id || plan._id || i}>
            <div className="watermark">
              {plan.watermarkUrl
                ? <img src={plan.watermarkUrl} alt="" />
                : <span className="wm-emoji">{plan.icon}</span>}
            </div>
            <div className="head">
              <span className="icon">{plan.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="title">{plan.title}</div>
                <div className="subtitle">{plan.subtitle}</div>
              </div>
              {i === popularIndex && <span className="popular">POPULAR</span>}
            </div>
            <div className="features">
              {(plan.features || []).slice(0, 6).map((f, fi) => (
                <span className="feature" key={fi}><span className="tick">✓</span>{f}</span>
              ))}
            </div>
            <div className="tags">
              {(plan.tags || []).slice(0, 3).map((t, ti) => <span className="tag" key={ti}>{t}</span>)}
            </div>
            <button
              className={`enroll${i === popularIndex ? ' solid' : ''}`}
              style={i === popularIndex ? { background: page.accentColor, borderColor: page.accentColor } : { borderColor: page.accentColor, color: page.accentColor }}
              onClick={onEnroll ? () => onEnroll(plan) : undefined}
            >
              Enroll on WhatsApp ›
            </button>
          </div>
        ))}
      </div>
      <footer className="patient-footer">{page.footerText}</footer>
    </>
  );
}
