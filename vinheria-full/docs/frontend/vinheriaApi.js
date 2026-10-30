// Cliente opcional da API Vinheria Full (fetch). Uma função por endpoint; use, adapte ou ignore.
//   import { createVinheriaApi, ApiError } from './vinheriaApi';
//   const api = createVinheriaApi('http://localhost:3000/api/v1');

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;   // HTTP (0 = backend inacessível)
    this.code = code;       // ex.: NOT_FOUND, INVALID_TRIGGERS, NETWORK_ERROR (ver docs/API.md)
    this.details = details;
  }
}

export function createVinheriaApi(baseUrl = 'http://localhost:3000/api/v1') {
  const base = baseUrl.replace(/\/+$/, '');

  async function request(method, path, { body, query } = {}) {
    const qs = query
      ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()
      : '';
    let res;
    try {
      res = await fetch(`${base}${path}${qs}`, {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new ApiError(0, 'NETWORK_ERROR', 'Não foi possível conectar ao backend', String(e));
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = data?.error ?? {};
      throw new ApiError(res.status, err.code ?? 'HTTP_ERROR', err.message ?? `HTTP ${res.status}`, err.details);
    }
    return data;
  }

  const d = (id) => `/devices/${encodeURIComponent(id)}`;

  return {
    health: () => request('GET', '/health'),
    healthDependencies: () => request('GET', '/health/dependencies'),
    listDevices: () => request('GET', '/devices'),
    createDevice: (input) => request('POST', '/devices', { body: input }),
    getDevice: (id) => request('GET', d(id)),
    deleteDevice: (id) => request('DELETE', d(id)),
    getCurrent: (id) => request('GET', `${d(id)}/measurements/current`),
    getHistory: (id, opts = {}) => request('GET', `${d(id)}/measurements/history`, { query: opts }), // { attribute, lastN, from, to, limit, offset }
    getTriggers: (id) => request('GET', `${d(id)}/triggers`),
    putTriggers: (id, triggers) => request('PUT', `${d(id)}/triggers`, { body: triggers }),
    getSettings: (id) => request('GET', `${d(id)}/settings`),
    patchSettings: (id, settings) => request('PATCH', `${d(id)}/settings`, { body: settings }),
    getAlerts: (id, limit) => request('GET', `${d(id)}/alerts`, { query: { limit } }),
    sendCommand: (id, command, parameter) => request('POST', `${d(id)}/commands`, { body: { command, parameter } }),
  };
}
