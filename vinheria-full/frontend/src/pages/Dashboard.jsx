
import { useEffect, useState } from "react";
import { ArrowLeft, Globe2, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import WorldMap from "../components/map/WorldMap";
import MeasurementChart from "../components/charts/MeasurementChart";
import { mockVinheriaApi } from "../services/mockVinheriaApi";
import { demoDevicesStorage } from "../services/demoDevicesStorage";
import { vinheriaApi } from "../services/vinheriaApi";
import "./Dashboard.css";

const REFRESH_INTERVAL_MS = 5000;

function mapDemoDevice(device) {
  const latitude =
    device.coordinates?.latitude ?? device.latitude;
  const longitude =
    device.coordinates?.longitude ?? device.longitude;

  return {
    id: device.id || device.deviceId,
    deviceId: device.deviceId,
    name: device.displayName || device.name,
    country: device.country || "",
    region: device.region || device.location || "",
    latitude,
    longitude,
    temperature: device.current?.temperature ?? device.temperature,
    humidity: device.current?.humidity ?? device.humidity,
    luminosity: device.current?.luminosity ?? device.luminosity,
    status: device.status || "ONLINE",
    history: device.history || [],
    isDemo: true,
  };
}

function mapHistoryToChart(response, current) {
  const pointsByTimestamp = new Map();
  const series = response?.series || {};

  for (const [sensor, readings] of Object.entries(series)) {
    if (!Array.isArray(readings)) continue;

    for (const reading of readings) {
      const timestamp = reading.timestamp;
      const value = Number(reading.value);

      if (
        !timestamp ||
        !Number.isFinite(Date.parse(timestamp)) ||
        reading.value === null ||
        reading.value === undefined ||
        !Number.isFinite(value)
      ) {
        continue;
      }

      if (!pointsByTimestamp.has(timestamp)) {
        pointsByTimestamp.set(timestamp, { timestamp });
      }

      pointsByTimestamp.get(timestamp)[sensor] = value;
    }
  }

  // Acrescenta a medição atual, caso seja mais recente que o histórico.
  if (current?.timestamp) {
    const timestamp = current.timestamp;

    if (Number.isFinite(Date.parse(timestamp))) {
      if (!pointsByTimestamp.has(timestamp)) {
        pointsByTimestamp.set(timestamp, { timestamp });
      }

      const currentPoint = pointsByTimestamp.get(timestamp);

      for (const sensor of [
        "temperature",
        "humidity",
        "luminosity",
      ]) {
        const rawValue = current[sensor];

        if (rawValue === null || rawValue === undefined) {
          continue;
        }

        const value = Number(rawValue);

        if (Number.isFinite(value)) {
          currentPoint[sensor] = value;
        }
      }
    }
  }

  return [...pointsByTimestamp.values()]
    .sort(
      (a, b) =>
        Date.parse(a.timestamp) - Date.parse(b.timestamp)
    )
    .slice(-24);
}

async function mapRealDeviceToDashboard(device) {
  let history = [];

  try {
    const response = await vinheriaApi.getMeasurementHistory(
      device.deviceId,
      { lastN: 24 }
    );

    history = mapHistoryToChart(response, device.current);
  } catch (error) {
    console.error(
      `Erro ao carregar histórico de ${device.deviceId}:`,
      error
    );

    history = mapHistoryToChart(null, device.current);
  }

  return {
    id: device.deviceId,
    deviceId: device.deviceId,
    name: device.displayName || device.deviceId,
    country: "",
    region: device.location || "",
    latitude: device.coordinates?.latitude,
    longitude: device.coordinates?.longitude,
    temperature: device.current?.temperature,
    humidity: device.current?.humidity,
    luminosity: device.current?.luminosity,
    status: device.status || "UNKNOWN",
    history,
    isDemo: false,
  };
}

function getTriggerConfig(response, sensor) {
  const root =
    response?.triggers ??
    response?.data?.triggers ??
    response?.data ??
    response;

  return (
    root?.[sensor] ??
    root?.sensors?.[sensor] ??
    {}
  );
}

function getLimitValue(trigger, keys) {
  for (const key of keys) {
    const value = trigger?.[key];

    if (value !== undefined && value !== null && value !== "") {
      const number = Number(value);

      if (Number.isFinite(number)) return number;
    }
  }

  return null;
}

function getSensorInfo(sensor) {
  const sensors = {
    temperature: {
      label: "Temperatura",
      unit: " °C",
      decimals: 1,
    },
    humidity: {
      label: "Umidade",
      unit: "%",
      decimals: 0,
    },
    luminosity: {
      label: "Luminosidade",
      unit: "%",
      decimals: 0,
    },
  };

  return sensors[sensor] || {
    label: sensor,
    unit: "",
    decimals: 1,
  };
}

function createAlertMessage(value, trigger, unit) {
  if (value === undefined || value === null) {
    return "Medição atual indisponível.";
  }

  const minimum = getLimitValue(trigger, [
    "min",
    "minimum",
    "minValue",
    "minThreshold",
  ]);

  const maximum = getLimitValue(trigger, [
    "max",
    "maximum",
    "maxValue",
    "maxThreshold",
  ]);

  if (minimum !== null && Number(value) < minimum) {
    return `Abaixo do mínimo permitido: ${minimum}${unit}`;
  }

  if (maximum !== null && Number(value) > maximum) {
    return `Acima do máximo permitido: ${maximum}${unit}`;
  }

  return "Alerta ativo segundo o monitoramento.";
}

function Dashboard() {
  const [wineries, setWineries] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadWineries() {
      let originalWineries = [];
      let demoDevices = [];
      let realDevices = [];

      // 1. Carrega os dados demonstrativos.
      try {
        originalWineries = await mockVinheriaApi.listWineries();
      } catch (error) {
        console.error(
          "Erro ao carregar vinherias demonstrativas:",
          error
        );
      }

      try {
        demoDevicesStorage.updateMeasurements();

        demoDevices = demoDevicesStorage
          .list()
          .map(mapDemoDevice);
      } catch (error) {
        console.error(
          "Erro ao carregar dispositivos demonstrativos:",
          error
        );
      }

      // 2. Consulta os dispositivos reais no backend.
      try {
        const devicesResponse = await vinheriaApi.listDevices();

        realDevices = await Promise.all(
          (devicesResponse?.devices || []).map(
            mapRealDeviceToDashboard
          )
        );
      } catch (error) {
        console.error(
          "Erro ao carregar dispositivos reais:",
          error
        );
      }

      // 3. Junta os dados demonstrativos e reais.
      if (active) {
        setWineries([
          ...originalWineries.map((winery) => ({
            ...winery,
            isDemo: true,
          })),
          ...demoDevices,
          ...realDevices,
        ]);
      }
    }

    async function loadAlerts() {
      try {
        const response = await vinheriaApi.listDevices();
        const devices = response?.devices || [];

        const devicesWithAlerts = devices.filter(
          (device) =>
            Array.isArray(device.activeAlerts) &&
            device.activeAlerts.length > 0
        );

        const alertsByDevice = await Promise.all(
          devicesWithAlerts.map(async (device) => {
            let triggerResponse = null;

            try {
              triggerResponse = await vinheriaApi.getTriggers(
                device.deviceId
              );
            } catch (error) {
              console.error(
                `Erro ao consultar limites de ${device.deviceId}:`,
                error
              );
            }

            return device.activeAlerts.map((sensor) => {
              const sensorInfo = getSensorInfo(sensor);
              const value = device.current?.[sensor];

              const trigger = getTriggerConfig(
                triggerResponse,
                sensor
              );

              const isOnline =
                device.status?.toUpperCase() === "ONLINE";

              return {
                id: `${device.deviceId}-${sensor}`,
                deviceName:
                  device.displayName || device.deviceId,
                location: device.location || "",
                sensor: sensorInfo.label,
                value:
                  value !== undefined && value !== null
                    ? `${Number(value).toFixed(sensorInfo.decimals)}${sensorInfo.unit}`
                    : "Indisponível",
                message: createAlertMessage(
                  value,
                  trigger,
                  sensorInfo.unit
                ),
                isOnline,
                statusLabel: isOnline
                  ? "ALERTA ATIVO"
                  : "ALERTA REGISTRADO",
                statusMessage: isOnline
                  ? ""
                  : "Dispositivo desconectado. Exibindo alerta da última leitura registrada.",
              };
            });
          })
        );

        if (active) {
          setActiveAlerts(alertsByDevice.flat());
        }
      } catch (error) {
        console.error(
          "Erro ao carregar os alertas dos dispositivos:",
          error
        );

        if (active) setActiveAlerts([]);
      }
    }

    async function loadDashboard() {
      try {
        await Promise.all([
          loadWineries(),
          loadAlerts(),
        ]);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();

    const refreshTimer = setInterval(
      loadDashboard,
      REFRESH_INTERVAL_MS
    );

    return () => {
      active = false;
      clearInterval(refreshTimer);
      mockVinheriaApi.stopUpdates();
    };
  }, []);

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Link to="/" className="dashboard-brand">
          <span className="dashboard-brand-mark">V.</span>
          <span>
            VINHERIA <strong>FULL</strong>
          </span>
        </Link>

        <Link to="/" className="dashboard-back-link">
          <ArrowLeft size={15} />
          Voltar ao início
        </Link>
      </header>

      <section className="dashboard-intro">
        <div className="dashboard-intro-icon">
          <Globe2 size={22} strokeWidth={1.4} />
        </div>

        <span className="dashboard-kicker">
          TERRITÓRIO · TECNOLOGIA · TRADIÇÃO
        </span>

        <h1>
          Uma rede sem
          <br />
          <em>fronteiras.</em>
        </h1>

        <p>
          Explore diferentes regiões produtoras e acompanhe as
          condições ambientais de cada vinheria.
        </p>
      </section>

      <div className="dashboard-map-content">
        <WorldMap />
      </div>

      <section className="dashboard-alerts">
        <div className="dashboard-alerts-heading">
          <div>
            <span className="dashboard-kicker">
              MONITORAMENTO DE ALERTAS
            </span>

            <h2>
              Atenção às <em>vinherias.</em>
            </h2>

            <p>
              Dispositivos conectados que apresentam medições
              fora dos limites configurados.
            </p>
          </div>

          <span className="dashboard-alert-count">
            {activeAlerts.length.toString().padStart(2, "0")}
            <small> alertas ativos</small>
          </span>
        </div>

        {loading ? (
          <p>Verificando alertas...</p>
        ) : activeAlerts.length === 0 ? (
          <div className="dashboard-no-alerts">
            <span>✓</span>
            Nenhuma vinheria conectada apresenta alertas ativos.
          </div>
        ) : (
          <div className="dashboard-alert-grid">
            {activeAlerts.map((alert) => (
              <article
                className="dashboard-alert-card"
                key={alert.id}
              >
                <div className="dashboard-alert-card-heading">
                  <AlertTriangle size={19} />
                  <span>{alert.statusLabel}</span>
                </div>

                <h3>{alert.deviceName}</h3>

                {alert.location && (
                  <p className="dashboard-alert-location">
                    {alert.location}
                  </p>
                )}

                <div className="dashboard-alert-measurement">
                  <span>{alert.sensor}</span>
                  <strong>{alert.value}</strong>
                </div>

                <p className="dashboard-alert-message">
                  {alert.message}
                </p>

                {!alert.isOnline && (
                  <p className="dashboard-alert-message">
                    {alert.statusMessage}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-measurements">
        <div className="dashboard-measurements-heading">
          <span className="dashboard-kicker">
            MONITORAMENTO AMBIENTAL
          </span>

          <h2>
            Leituras em <em>tempo real.</em>
          </h2>

          <p>
            Acompanhe a evolução das condições ambientais nas vinherias.
          </p>
        </div>

        {loading ? (
          <p>Carregando medições...</p>
        ) : wineries.length === 0 ? (
          <p>Nenhuma vinheria disponível.</p>
        ) : (
          <div className="dashboard-winery-grid">
            {wineries.map((winery) => (
              <section
                className="dashboard-winery"
                id={`vinheria-${winery.id}`}
                key={winery.id}
              >
                <div className="dashboard-winery-heading">
                  <div>
                    <span>
                      {[winery.region, winery.country]
                        .filter(Boolean)
                        .join(", ")}
                    </span>

                    <h3>{winery.name}</h3>
                  </div>

                  <span className="dashboard-demo-label">
                    {winery.isDemo
                      ? "DEMONSTRATIVO"
                      : "DISPOSITIVO REAL"}
                  </span>
                </div>

                <div className="dashboard-chart-grid">
                  <MeasurementChart
                    title="Temperatura"
                    data={winery.history}
                    dataKey="temperature"
                    unit=" °C"
                    color="#722F3F"
                  />

                  <MeasurementChart
                    title="Umidade"
                    data={winery.history}
                    dataKey="humidity"
                    unit="%"
                    color="#567D8A"
                    decimals={0}
                  />

                  <MeasurementChart
                    title="Luminosidade"
                    data={winery.history}
                    dataKey="luminosity"
                    unit="%"
                    color="#B49A69"
                    decimals={0}
                  />
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <footer className="dashboard-footer">
        <span>VINHERIA FULL</span>
        <span>CP5 · EDGE COMPUTING</span>
      </footer>
    </main>
  );
}

export default Dashboard;
