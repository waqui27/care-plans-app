import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { api, auth } from '../api.js';

export default function AdminLayout({ children }) {
  const nav = useNavigate();
  const [quota, setQuota] = useState(null);
  const [newLeads, setNewLeads] = useState(0);

  useEffect(() => {
    api.get('/pages').then(r => setQuota({ used: r.data.used, total: r.data.quota })).catch(() => {});
    api.get('/leads').then(r => setNewLeads(r.data.leads.filter(l => l.status === 'new').length)).catch(() => {});
  }, []);

  const items = [
    { to: '/dashboard', label: 'Pages' },
    { to: '/leads', label: 'Leads', badge: newLeads ? `${newLeads} new` : null },
    { to: '/library', label: 'Plan Library' },
    { to: '/analytics', label: 'Analytics' },
    { to: '/settings', label: 'Settings' },
  ];

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-logo"><div className="tile">M</div><span>Mamily Admin</span></div>
        {items.map(it => (
          <NavLink key={it.to} to={it.to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="dot" /><span className="nav-label">{it.label}</span>
            {it.badge && <span className="badge">{it.badge}</span>}
          </NavLink>
        ))}
        <div className="sidebar-user">
          <div className="avatar">{(auth.email || 'A')[0].toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <div className="u-email" style={{ fontWeight: 600, color: 'var(--ink-admin)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{auth.email}</div>
            {quota && <div className="u-quota">{quota.used} / {quota.total} pages used</div>}
            <button style={{ fontSize: 10.5, color: 'var(--muted)', padding: 0, textDecoration: 'underline' }}
              onClick={() => { auth.logout(); nav('/login'); }}>Sign out</button>
          </div>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
