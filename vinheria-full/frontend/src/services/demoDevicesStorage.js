
const STORAGE_KEY = "vinheria-full-demo-devices";
const MAX_HISTORY_POINTS = 24;
const UPDATE_INTERVAL_MS = 5000;

function readDevices() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return [];

    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDevices(devices) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
}

function vary(value, amplitude, minimum, maximum, decimals = 1) {
  const variation = (Math.random() * 2 - 1) * amplitude;
  const nextValue = value + variation;

  return Number(
    Math.min(maximum, Math.max(minimum, nextValue)).toFixed(decimals)
  );
}

function createMeasurement(device, timestamp = new Date().toISOString()) {
  return {
    timestamp,
    temperature: vary(device.current.temperature, 0.5, 10, 25),
    humidity: vary(device.current.humidity, 2, 40, 90, 0),
    luminosity: vary(device.current.luminosity, 5, 0, 100, 0),
  };
}

function createInitialHistory(current) {
  const now = Date.now();

  return Array.from({ length: 12 }, (_, index) => {
    const timestamp = new Date(
      now - (11 - index) * UPDATE_INTERVAL_MS
    ).toISOString();

    return {
      timestamp,
      temperature: vary(current.temperature, 0.5, 10, 25),
      humidity: vary(current.humidity, 2, 40, 90, 0),
      luminosity: vary(current.luminosity, 5, 0, 100, 0),
    };
  });
}

export const demoDevicesStorage = {
  list() {
    return readDevices();
  },

  create(input) {
    const devices = readDevices();
    const deviceId =
      input.deviceId?.trim() || `demo-${Date.now().toString(36)}`;

    if (devices.some((device) => device.deviceId === deviceId)) {
      throw new Error(
        "Já existe um dispositivo demonstrativo com esse identificador."
      );
    }

    const latitude =
      input.latitude !== undefined && input.latitude !== ""
        ? Number(input.latitude)
        : null;

    const longitude =
      input.longitude !== undefined && input.longitude !== ""
        ? Number(input.longitude)
        : null;

    if (
      (latitude !== null && !Number.isFinite(latitude)) ||
      (longitude !== null && !Number.isFinite(longitude))
    ) {
      throw new Error("Informe coordenadas válidas.");
    }

    if (
      (latitude === null) !== (longitude === null) ||
      (latitude !== null && (latitude < -90 || latitude > 90)) ||
      (longitude !== null && (longitude < -180 || longitude > 180))
    ) {
      throw new Error(
        "Informe latitude e longitude válidas para exibir o dispositivo no mapa."
      );
    }

    const current = {
      temperature: Number(
        (16 + Math.random() * 5).toFixed(1)
      ),
      humidity: Math.round(60 + Math.random() * 20),
      luminosity: Math.round(30 + Math.random() * 40),
      timestamp: new Date().toISOString(),
    };

    const device = {
      id: deviceId,
      deviceId,
      displayName: input.displayName.trim(),
      name: input.displayName.trim(),
      location: input.location.trim(),
      country: input.country?.trim() || "",
      region: input.region?.trim() || "",
      coordinates:
        latitude !== null && longitude !== null
          ? { latitude, longitude }
          : null,
      latitude,
      longitude,
      status: "ONLINE",
      isDemo: true,
      current,
      lastSeen: current.timestamp,
      lastUpdated: current.timestamp,
      activeAlerts: [],
      history: createInitialHistory(current),
    };

    saveDevices([...devices, device]);

    return device;
  },

  updateMeasurements() {
    const devices = readDevices();

    const updatedDevices = devices.map((device) => {
      if (!device.current) return device;

      const measurement = createMeasurement(device);
      const history = [
        ...(device.history || []),
        measurement,
      ].slice(-MAX_HISTORY_POINTS);

      return {
        ...device,
        current: {
          temperature: measurement.temperature,
          humidity: measurement.humidity,
          luminosity: measurement.luminosity,
          timestamp: measurement.timestamp,
        },
        temperature: measurement.temperature,
        humidity: measurement.humidity,
        luminosity: measurement.luminosity,
        lastSeen: measurement.timestamp,
        lastUpdated: measurement.timestamp,
        history,
      };
    });

    saveDevices(updatedDevices);

    return updatedDevices;
  },

  remove(deviceId) {
    const devices = readDevices();
    const updated = devices.filter(
      (device) => device.deviceId !== deviceId
    );

    saveDevices(updated);

    return updated;
  },
};
