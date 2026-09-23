const BASE_URL = import.meta.env?.VITE_API_URL ?? '/api';

const TOKEN_KEY = 'silverpass.token';

export const tokenStore = {
  get() {
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      if (token) window.localStorage.setItem(TOKEN_KEY, token);
      else window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      // A session that lasts only until the tab closes still beats an error.
    }
  },
};

/** Carries the server's structured error through to the UI unchanged. */
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message ?? 'Something went wrong. Please try again.');
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.error?.code ?? 'UNKNOWN';
    this.details = body?.error?.details;
  }

  /** `{ fieldName: 'message' }` for rendering errors next to each input. */
  get fieldErrors() {
    return (this.details?.fields ?? []).reduce((acc, field) => {
      acc[field.field] = field.message;
      return acc;
    }, {});
  }
}

async function request(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';

  const token = auth ? tokenStore.get() : null;
  if (token) headers.authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(0, {
      error: { code: 'NETWORK', message: 'We could not reach SilverPass. Check your connection.' },
    });
  }

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, payload);
  return payload;
}

const qs = (params) => `?${new URLSearchParams(params)}`;

export const api = {
  health: () => request('/health', { auth: false }),
  services: () => request('/services', { auth: false }),
  centers: () => request('/centers', { auth: false }),

  register: (body) => request('/auth/register', { method: 'POST', body, auth: false }),
  login: (body) => request('/auth/login', { method: 'POST', body, auth: false }),
  me: (signal) => request('/auth/me', { signal }),
  updateProfile: (body) => request('/auth/me', { method: 'PATCH', body }),

  listApplications: (signal) => request('/applications', { signal }),
  createApplication: (body) => request('/applications', { method: 'POST', body }),
  getApplication: (id, signal) => request(`/applications/${id}`, { signal }),
  updateApplication: (id, body) => request(`/applications/${id}`, { method: 'PATCH', body }),
  setDocument: (id, body) => request(`/applications/${id}/documents`, { method: 'PUT', body }),
  submitApplication: (id) => request(`/applications/${id}/submit`, { method: 'POST' }),
  cancelApplication: (id) => request(`/applications/${id}`, { method: 'DELETE' }),
  trackApplication: (reference) =>
    request(`/applications/track/${encodeURIComponent(reference)}`, { auth: false }),

  listAppointments: (signal) => request('/appointments', { signal }),
  openDates: (signal) => request('/appointments/open-dates', { signal }),
  slots: (params, signal) => request(`/appointments/slots${qs(params)}`, { signal }),
  bookAppointment: (body) => request('/appointments', { method: 'POST', body }),
  cancelAppointment: (id) => request(`/appointments/${id}`, { method: 'DELETE' }),
};
