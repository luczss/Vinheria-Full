
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:3000/api/v1";

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      "Não foi possível conectar ao backend. Verifique se a API está em execução."
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `Erro na requisição: HTTP ${response.status}`;

    throw new Error(message);
  }

  return data;
}

function encodeId(deviceId) {
  return encodeURIComponent(deviceId);
}

export const vinheriaApi = {
  getHealth() {
    return request("/health");
  },

  getDependenciesHealth() {
    return request("/health/dependencies");
  },

  listDevices() {
    return request("/devices");
  },

  getDevice(deviceId) {
    return request(`/devices/${encodeId(deviceId)}`);
  },

  createDevice(device) {
    return request("/devices", {
      method: "POST",
      body: JSON.stringify(device),
    });
  },

  deleteDevice(deviceId) {
    return request(`/devices/${encodeId(deviceId)}`, {
      method: "DELETE",
    });
  },

  getCurrentMeasurements(deviceId) {
    return request(
      `/devices/${encodeId(deviceId)}/measurements/current`
    );
  },

  getMeasurementHistory(deviceId, filters = {}) {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== "") {
        query.set(key, String(value));
      }
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : "";

    return request(
      `/devices/${encodeId(deviceId)}/measurements/history${suffix}`
    );
  },

  getTriggers(deviceId) {
    return request(
      `/devices/${encodeId(deviceId)}/triggers`
    );
  },

  updateTriggers(deviceId, triggers) {
    return request(
      `/devices/${encodeId(deviceId)}/triggers`,
      {
        method: "PUT",
        body: JSON.stringify(triggers),
      }
    );
  },

  getSettings(deviceId) {
    return request(`/devices/${encodeId(deviceId)}/settings`);
  },

  updateSettings(deviceId, settings) {
    return request(`/devices/${encodeId(deviceId)}/settings`, {
      method: "PATCH",
      body: JSON.stringify(settings),
    });
  },

  getAlerts(deviceId, limit = 20) {
    const query = new URLSearchParams({
      limit: String(limit),
    });

    return request(
      `/devices/${encodeId(deviceId)}/alerts?${query.toString()}`
    );
  },

  sendCommand(deviceId, command, parameter) {
    return request(`/devices/${encodeId(deviceId)}/commands`, {
      method: "POST",
      body: JSON.stringify({ command, parameter }),
    });
  },
};

export default vinheriaApi;
