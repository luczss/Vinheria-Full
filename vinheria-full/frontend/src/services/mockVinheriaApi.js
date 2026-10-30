
const MOCK_INTERVAL_MS = 5000;
const MAX_HISTORY_POINTS = 24;

const initialWineries = [
  {
    id: "mock-argentina",
    deviceId: "mock-argentina",
    name: "Vinheria Argentina",
    country: "Argentina",
    region: "Mendoza",
    latitude: -32.89,
    longitude: -68.83,
    temperature: 17.4,
    humidity: 68,
    luminosity: 48,
    status: "ONLINE",
  },
  {
    id: "mock-franca",
    deviceId: "mock-franca",
    name: "Vinheria França",
    country: "França",
    region: "Bordeaux",
    latitude: 44.84,
    longitude: -0.58,
    temperature: 15.9,
    humidity: 74,
    luminosity: 35,
    status: "ONLINE",
  },
  {
    id: "mock-italia",
    deviceId: "mock-italia",
    name: "Vinheria Itália",
    country: "Itália",
    region: "Toscana",
    latitude: 43.77,
    longitude: 11.25,
    temperature: 16.2,
    humidity: 70,
    luminosity: 39,
    status: "ONLINE",
  },
  {
    id: "mock-portugal",
    deviceId: "mock-portugal",
    name: "Vinheria Portugal",
    country: "Portugal",
    region: "Douro",
    latitude: 41.16,
    longitude: -7.79,
    temperature: 16.5,
    humidity: 71,
    luminosity: 44,
    status: "ONLINE",
  },
];

function createHistory(winery) {
  const now = Date.now();

  return Array.from({ length: 12 }, (_, index) => ({
    timestamp: new Date(now - (11 - index) * MOCK_INTERVAL_MS).toISOString(),
    temperature: Number(
      (winery.temperature + (Math.random() - 0.5) * 1.4).toFixed(1)
    ),
    humidity: Math.round(
      winery.humidity + (Math.random() - 0.5) * 6
    ),
    luminosity: Math.round(
      winery.luminosity + (Math.random() - 0.5) * 10
    ),
  }));
}

let wineries = initialWineries.map((winery) => {
  const history = createHistory(winery);

  return {
    ...winery,
    lastUpdated: history[history.length - 1].timestamp,
    history,
  };
});

let updateTimer = null;

function vary(value, amplitude, minimum, maximum, decimals = 1) {
  const variation = (Math.random() * 2 - 1) * amplitude;
  const nextValue = value + variation;

  return Number(
    Math.min(maximum, Math.max(minimum, nextValue)).toFixed(decimals)
  );
}

function updateMeasurements() {
  wineries = wineries.map((winery) => {
    const timestamp = new Date().toISOString();

    const measurement = {
      timestamp,
      temperature: vary(winery.temperature, 0.5, 10, 25),
      humidity: vary(winery.humidity, 2, 40, 90, 0),
      luminosity: vary(winery.luminosity, 5, 0, 100, 0),
    };

    const history = [
      ...winery.history,
      measurement,
    ].slice(-MAX_HISTORY_POINTS);

    return {
      ...winery,
      ...measurement,
      lastUpdated: timestamp,
      history,
    };
  });
}

function startUpdates() {
  if (updateTimer !== null) return;

  updateTimer = setInterval(updateMeasurements, MOCK_INTERVAL_MS);
}

function stopUpdates() {
  if (updateTimer !== null) {
    clearInterval(updateTimer);
    updateTimer = null;
  }
}

function cloneWinery(winery) {
  return {
    ...winery,
    history: winery.history.map((point) => ({ ...point })),
  };
}

export const mockVinheriaApi = {
  listWineries() {
    startUpdates();

    return Promise.resolve(wineries.map(cloneWinery));
  },

  getWineries() {
    return this.listWineries();
  },

  getWinery(deviceId) {
    startUpdates();

    const winery = wineries.find((item) => item.deviceId === deviceId);

    return Promise.resolve(winery ? cloneWinery(winery) : null);
  },

  getUpdateInterval() {
    return MOCK_INTERVAL_MS;
  },

  stopUpdates,
};
