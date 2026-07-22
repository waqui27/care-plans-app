import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { onServerStatus } from '../api.js';

// Thin fixed bar shown while the (free-tier) API is cold-starting / unreachable.
// Never shown on the public patient pages (/p/:slug) — a "connecting" banner
// would alarm patients; those pages have their own quiet "Loading…" state.
export default function ServerStatusBanner() {
  const [waking, setWaking] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => onServerStatus(setWaking), []);
  if (!waking || pathname.startsWith('/p/')) return null;
  return (
    <div className="server-banner" role="status" aria-live="polite">
      <span className="server-banner-dot" />
      Connecting to the server… this can take up to a minute on the first request.
    </div>
  );
}
