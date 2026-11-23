const BASE = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, "");
const KEY = "dara_admin_session";

export const session = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || "null");
    } catch {
      return null;
    }
  },
  set(data, remember = true) {
    const store = remember ? localStorage : sessionStorage;
    (remember ? sessionStorage : localStorage).removeItem(KEY);
    store.setItem(KEY, JSON.stringify(data));
  },
  update(patch) {
    const cur = this.get();
    if (!cur) return;
    const remember = Boolean(localStorage.getItem(KEY));
    this.set({ ...cur, ...patch }, remember);
  },
  clear() {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  },
};

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

let refreshing = null;
async function refresh() {
  const s = session.get();
  if (!s?.refreshToken) throw new ApiError(401, "Session expired");
  refreshing ??= fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: s.refreshToken }),
  })
    .then(async (r) => {
      const j = await r.json();
      if (!r.ok) throw new ApiError(401, j.message || "Session expired");
      session.update({ accessToken: j.data.accessToken, refreshToken: j.data.refreshToken, user: j.data.user, capabilities: j.data.capabilities });
      return j.data;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Fetch wrapper: JSON in/out, Bearer token, one automatic token refresh on 401. */
export async function api(path, { method = "GET", body, query, form, retry = true, raw = false } = {}) {
  const qs = query
    ? "?" +
      new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString()
    : "";
  const s = session.get();
  const res = await fetch(`${BASE}${path}${qs}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(s?.accessToken ? { Authorization: `Bearer ${s.accessToken}` } : {}),
    },
    body: form || (body !== undefined ? JSON.stringify(body) : undefined),
  });
  if (res.status === 401 && retry && s?.refreshToken && !path.startsWith("/auth/")) {
    try {
      await refresh();
      return api(path, { method, body, query, form, retry: false, raw });
    } catch {
      session.clear();
      window.dispatchEvent(new Event("dara:logout"));
      throw new ApiError(401, "Your session has expired. Please log in again.");
    }
  }
  if (raw) return res;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.message || `Request failed (${res.status})`, json.details);
  return json;
}

export const get = (p, query) => api(p, { query });
export const post = (p, body) => api(p, { method: "POST", body: body ?? {} });
export const put = (p, body) => api(p, { method: "PUT", body });
export const del = (p, query) => api(p, { method: "DELETE", query });

export const SITE_URL = (import.meta.env.VITE_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
