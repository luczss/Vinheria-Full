
import { useEffect, useState } from "react";
import {
  ChartNoAxesCombined,
  CircleHelp,
  MapPin,
} from "lucide-react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
} from "react-leaflet";
import { mockVinheriaApi } from "../../services/mockVinheriaApi";
import { demoDevicesStorage } from "../../services/demoDevicesStorage";
import { vinheriaApi } from "../../services/vinheriaApi";
import "./WorldMap.css";

const REFRESH_INTERVAL_MS = 5000;

function hasValidCoordinates(latitude, longitude) {
  if (
    latitude === null ||
    latitude === undefined ||
    latitude === "" ||
    longitude === null ||
    longitude === undefined ||
    longitude === ""
  ) {
    return false;
  }

  return (
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude))
  );
}

function mapDemoDevice(device) {
  const rawLatitude =
    device.coordinates?.latitude ?? device.latitude;

  const rawLongitude =
    device.coordinates?.longitude ?? device.longitude;

  if (!hasValidCoordinates(rawLatitude, rawLongitude)) {
    return null;
  }

  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  const current = device.current || {};

  return {
    id: device.id || device.deviceId,
    deviceId: device.deviceId,
    name: device.displayName || device.name,
    country: device.country || "",
    region: device.region || device.location || "",
    latitude,
    longitude,
    temperature:
      current.temperature ?? device.temperature ?? null,
    humidity:
      current.humidity ?? device.humidity ?? null,
    luminosity:
      current.luminosity ?? device.luminosity ?? null,
    status: device.status || "ONLINE",
    isDemo: true,
  };
}

function mapRealDevice(device) {
  const rawLatitude = device.coordinates?.latitude;
  const rawLongitude = device.coordinates?.longitude;

  // Coordenadas são opcionais no cadastro.
  // Sem latitude e longitude, o dispositivo não pode aparecer no mapa.
  if (!hasValidCoordinates(rawLatitude, rawLongitude)) {
    return null;
  }

  return {
    id: device.deviceId,
    deviceId: device.deviceId,
    name: device.displayName || device.deviceId,
    country: "",
    region: device.location || "",
    latitude: Number(rawLatitude),
    longitude: Number(rawLongitude),
    temperature: device.current?.temperature,
    humidity: device.current?.humidity,
    luminosity: device.current?.luminosity,
    status: device.status || "UNKNOWN",
    isDemo: false,
  };
}

function WorldMap() {
  const [wineries, setWineries] = useState([]);
  const [selectedWineryId, setSelectedWineryId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let refreshTimer;

    async function loadWineries() {
      let originalWineries = [];
      let demoDevices = [];
      let realDevices = [];
      let backendFailed = false;

      // 1. Carrega as vinherias demonstrativas originais.
      try {
        originalWineries = await mockVinheriaApi.listWineries();
      } catch (err) {
        console.error(
          "Erro ao carregar vinherias demonstrativas:",
          err
        );
      }

      // 2. Atualiza e carrega os dispositivos demonstrativos locais.
      try {
        demoDevicesStorage.updateMeasurements();

        demoDevices = demoDevicesStorage
          .list()
          .map(mapDemoDevice)
          .filter(Boolean);
      } catch (err) {
        console.error(
          "Erro ao carregar dispositivos demonstrativos:",
          err
        );
      }

      // 3. Consulta os dispositivos reais no backend.
      // A falha desta consulta não impede a exibição dos demonstrativos.
      try {
        const response = await vinheriaApi.listDevices();

        realDevices = (response?.devices || [])
          .map(mapRealDevice)
          .filter(Boolean);
      } catch (err) {
        backendFailed = true;

        console.error(
          "Erro ao consultar dispositivos reais:",
          err
        );
      }

      if (!active) return;

      // 4. Junta os dispositivos em uma única lista.
      setWineries([
        ...originalWineries.map((winery) => ({
          ...winery,
          isDemo: true,
        })),
        ...demoDevices,
        ...realDevices,
      ]);

      if (backendFailed) {
        setError(
          "Não foi possível consultar os dispositivos reais. Os dados demonstrativos continuam disponíveis."
        );
      } else {
        setError("");
      }

      setLoading(false);
    }

    loadWineries();

    refreshTimer = setInterval(
      loadWineries,
      REFRESH_INTERVAL_MS
    );

    return () => {
      active = false;
      clearInterval(refreshTimer);
      mockVinheriaApi.stopUpdates();
    };
  }, []);

  function goToWineryCharts(wineryId) {
    const section = document.getElementById(
      `vinheria-${wineryId}`
    );

    if (!section) return;

    section.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <section className="world-map-section">
      <div className="map-heading">
        <div>
          <span className="map-eyebrow">
            <span className="map-eyebrow-line" />
            EXPLORAÇÃO GLOBAL
          </span>

          <h2>
            Vinherias pelo <em>mundo.</em>
          </h2>

          <p>
            Explore as regiões e selecione um marcador para conhecer
            cada vinheria.
          </p>
        </div>

        <div className="map-counter">
          <GlobeLabel />

          <div>
            <strong>
              {wineries.length.toString().padStart(2, "0")}
            </strong>

            <span>pontos no mapa</span>
          </div>
        </div>
      </div>

      <div className="map-frame">
        <MapContainer
          center={[25, 0]}
          zoom={2}
          minZoom={2}
          maxZoom={10}
          scrollWheelZoom
          touchZoom
          worldCopyJump
          className="world-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {wineries.map((winery) => (
            <CircleMarker
              key={winery.id}
              center={[winery.latitude, winery.longitude]}
              radius={selectedWineryId === winery.id ? 10 : 7}
              pathOptions={{
                color: "#FFFEFA",
                weight: 2,
                fillColor:
                  selectedWineryId === winery.id
                    ? "#B49A69"
                    : winery.isDemo
                      ? "#722F3F"
                      : "#27845A",
                fillOpacity: 1,
              }}
              eventHandlers={{
                click: () => setSelectedWineryId(winery.id),
              }}
            >
              <Popup>
                <div className="map-popup">
                  <span className="popup-label">
                    {winery.isDemo
                      ? "DADO DEMONSTRATIVO"
                      : "DISPOSITIVO REAL"}
                  </span>

                  <strong>{winery.name}</strong>

                  <span>
                    {[winery.region, winery.country]
                      .filter(Boolean)
                      .join(", ")}
                  </span>

                  <div className="popup-metrics">
                    <span>
                      Temperatura
                      <strong>
                        {Number.isFinite(Number(winery.temperature)) &&
                        winery.temperature !== null &&
                        winery.temperature !== undefined
                          ? `${Number(winery.temperature).toFixed(1)} °C`
                          : "—"}
                      </strong>
                    </span>

                    <span>
                      Umidade
                      <strong>
                        {Number.isFinite(Number(winery.humidity)) &&
                        winery.humidity !== null &&
                        winery.humidity !== undefined
                          ? `${Number(winery.humidity).toFixed(0)}%`
                          : "—"}
                      </strong>
                    </span>

                    <span>
                      Luminosidade
                      <strong>
                        {Number.isFinite(Number(winery.luminosity)) &&
                        winery.luminosity !== null &&
                        winery.luminosity !== undefined
                          ? `${Number(winery.luminosity).toFixed(0)}%`
                          : "—"}
                      </strong>
                    </span>
                  </div>

                  <p>
                    {winery.isDemo
                      ? "Leituras simuladas atualizadas periodicamente."
                      : `Dispositivo ${winery.status?.toLowerCase() || "sem status"} — leituras recebidas pelo backend.`}
                  </p>

                  <button
                    type="button"
                    className="popup-chart-link"
                    onClick={() => goToWineryCharts(winery.id)}
                  >
                    <ChartNoAxesCombined size={15} />
                    Ver gráficos
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        <div className="map-legend">
          <span className="legend-dot" />
          <span>Demonstrativos</span>

          <span
            className="legend-dot"
            style={{ backgroundColor: "#27845A" }}
          />
          <span>Dispositivos reais</span>
        </div>
      </div>

      <div className="map-bottom-note">
        <MapPin size={16} strokeWidth={1.5} />

        <p>
          {loading
            ? "Carregando dispositivos..."
            : error ||
              "Marcadores demonstrativos exibem leituras simuladas. Marcadores reais utilizam dados do backend."}
        </p>
      </div>
    </section>
  );
}

function GlobeLabel() {
  return (
    <span className="map-globe-icon" aria-hidden="true">
      <CircleHelp size={20} strokeWidth={1.4} />
    </span>
  );
}

export default WorldMap;
