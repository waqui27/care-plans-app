import { useEffect, useState } from 'react';
import { onServerStatus } from '../api.js';

// Thin fixed bar shown while the (free-tier) API is cold-starting / unreachable.
export default function ServerStatusBanner() {
  const [waking, setWaking] = useState(false);
  useEffect(() => onServerStatus(setWaking), []);
  if (!waking) return null;
  return (
    <div className="server-banner" role="status" aria-live="polite">
      <span className="server-banner-dot" />
      Connecting to the server… this can take up to a minute on the first request.
    </div>
  );
}
