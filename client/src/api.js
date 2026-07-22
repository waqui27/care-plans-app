import axios from 'axios';

// Same-origin '/api' by default (dev proxy / co-hosted); set VITE_API_URL to the
// API's full base when the client and server are on different domains.
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api' });

/* ── Server "waking up" status ──────────────────────────────────────────────
   Free hosting (e.g. Render free tier) spins the API down when idle; the first
   request then takes ~30–60s while it cold-starts. We surface that as a global
   banner: shown when a request is slow or the server is unreachable, hidden once
   it responds. Also retries cold-start failures (network error / 502-504). */
const SLOW_MS = 2500;        // a request slower than this is treated as a cold start
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

let inflight = 0;
let slowTimer = null;
let waking = false;
const listeners = new Set();

function setWaking(v) {
  if (waking === v) return;
  waking = v;
  listeners.forEach(fn => fn(waking));
}
export function onServerStatus(fn) {
  listeners.add(fn);
  fn(waking);
  return () => listeners.delete(fn);
}
export function isServerWaking() { return waking; }

function requestStarted() {
  inflight += 1;
  if (inflight === 1 && !slowTimer) slowTimer = setTimeout(() => setWaking(true), SLOW_MS);
}
function requestSettled() {
  inflight = Math.max(0, inflight - 1);
  if (inflight === 0) {
    clearTimeout(slowTimer);
    slowTimer = null;
    setWaking(false);
  }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

api.interceptors.request.use(config => {
  if (!config.__retrying) requestStarted();
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => { requestSettled(); return res; },
  async err => {
    const cfg = err.config || {};
    const coldStart = !err.response || [502, 503, 504].includes(err.response.status);
    if (coldStart && (cfg.__retryCount || 0) < MAX_RETRIES) {
      cfg.__retryCount = (cfg.__retryCount || 0) + 1;
      cfg.__retrying = true;        // keep the same inflight slot across retries
      setWaking(true);
      await sleep(RETRY_DELAY_MS);
      return api(cfg);
    }
    requestSettled();
    if (err.response?.status === 401 && !location.pathname.startsWith('/p/')) {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('email');
      if (location.pathname !== '/login') location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Proactively warm the server (and trigger the banner) as soon as the app loads.
export function pingServer() {
  api.get('/health').catch(() => {});
}

export const auth = {
  get token() { return localStorage.getItem('token'); },
  get role() { return localStorage.getItem('role'); },
  get email() { return localStorage.getItem('email'); },
  login({ token, role, email }) {
    localStorage.setItem('token', token);
    localStorage.setItem('role', role);
    localStorage.setItem('email', email);
  },
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('email');
  },
};

export function waLink(number, template, vars) {
  let msg = template || '';
  for (const [k, v] of Object.entries(vars)) msg = msg.replaceAll(`{${k}}`, v);
  return `https://wa.me/${String(number).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`;
}

export function timeAgo(date) {
  const s = (Date.now() - new Date(date).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
