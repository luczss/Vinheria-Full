
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Cpu,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { vinheriaApi } from "../services/vinheriaApi";
import { demoDevicesStorage } from "../services/demoDevicesStorage";
import TriggerSettings from "./TriggerSettings";
import "./Devices.css";

const EMPTY_FORM = {
  deviceId: "",
  displayName: "",
  location: "",
  latitude: "",
  longitude: "",
};

const REFRESH_INTERVAL_MS = 5000;

function formatDate(value) {
  if (!value) return "Sem leitura registrada";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Data indisponível";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatValue(value, unit = "") {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? `${number.toLocaleString("pt-BR", {
        maximumFractionDigits: 2,
      })}${unit}`
    : "—";
}

function DeviceStatus({ status }) {
  const normalized = String(status || "").toUpperCase();

  let label = "Desconhecido";
  let className = "devices-status-unknown";

  if (["ONLINE", "CONNECTED", "ACTIVE"].includes(normalized)) {
    label = "Conectado";
    className = "devices-status-online";
  } else if (
    ["OFFLINE", "DISCONNECTED", "INACTIVE"].includes(normalized)
  ) {
    label = "Desconectado";
    className = "devices-status-offline";
  }

  return (
    <span className={`devices-status ${className}`}>
      <span className="devices-status-dot" />
      {label}
    </span>
  );
}

function Devices() {
  const [devices, setDevices] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [mode, setMode] = useState("real");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadDevices = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true);

    try {
      const demoDevices = demoDevicesStorage.list();

      try {
        const response = await vinheriaApi.listDevices();

        const realDevices = Array.isArray(response.devices)
          ? response.devices.map((device) => ({
              ...device,
              isDemo: false,
            }))
          : [];

        setDevices([...realDevices, ...demoDevices]);
        setError("");
      } catch (err) {
        setDevices(demoDevices);
        setError(
          demoDevices.length > 0
            ? "Backend indisponível. Os dispositivos demonstrativos continuam funcionando neste navegador."
            : err.message ||
                "Não foi possível carregar os dispositivos reais."
        );
      }
    } catch (err) {
      setError(err.message || "Não foi possível carregar os dispositivos.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function refreshDemoDevices() {
      try {
        demoDevicesStorage.updateMeasurements();

        if (active) {
          const demos = demoDevicesStorage.list();

          setDevices((current) => {
            const realDevices = current.filter((device) => !device.isDemo);
            return [...realDevices, ...demos];
          });
        }
      } catch (err) {
        console.error("Erro ao atualizar demonstrativos:", err);
      }
    }

    loadDevices();

    const timer = setInterval(() => {
      refreshDemoDevices();
    }, REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [loadDevices]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const hasLatitude = form.latitude.trim() !== "";
    const hasLongitude = form.longitude.trim() !== "";

    if (hasLatitude !== hasLongitude) {
      setError(
        "Preencha latitude e longitude juntas ou deixe ambas vazias."
      );
      return;
    }

    const payload = {
      displayName: form.displayName.trim(),
      location: form.location.trim(),
    };

    if (form.deviceId.trim()) {
      payload.deviceId = form.deviceId.trim();
    }

    if (hasLatitude && hasLongitude) {
      payload.latitude = Number(form.latitude);
      payload.longitude = Number(form.longitude);

      if (
        !Number.isFinite(payload.latitude) ||
        !Number.isFinite(payload.longitude) ||
        payload.latitude < -90 ||
        payload.latitude > 90 ||
        payload.longitude < -180 ||
        payload.longitude > 180
      ) {
        setError(
          "Coordenadas inválidas. A latitude deve estar entre -90 e 90 e a longitude entre -180 e 180."
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      let created;

      if (mode === "demo") {
        created = demoDevicesStorage.create(payload);

        setDevices((current) => [
          ...current.filter((device) => !device.isDemo),
          ...demoDevicesStorage.list(),
        ]);
      } else {
        created = await vinheriaApi.createDevice(payload);
        await loadDevices({ showLoading: false });
      }

      setForm(EMPTY_FORM);

      setSuccess(
        `Dispositivo "${created.displayName || created.deviceId}" cadastrado como ${
          mode === "demo" ? "demonstrativo" : "real"
        }.`
      );
    } catch (err) {
      setError(err.message || "Não foi possível cadastrar o dispositivo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(device) {
    const kind = device.isDemo ? "demonstrativo" : "real";
    const deviceName = device.displayName || device.deviceId;

    const confirmed = window.confirm(
      `Deseja realmente remover o dispositivo ${kind} "${deviceName}"?`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setDeletingId(device.deviceId);

    try {
      if (device.isDemo) {
        demoDevicesStorage.remove(device.deviceId);

        setDevices((current) =>
          current.filter(
            (item) =>
              !(item.isDemo && item.deviceId === device.deviceId)
          )
        );

        setSuccess(`Dispositivo "${deviceName}" removido.`);
      } else {
        await vinheriaApi.deleteDevice(device.deviceId);
        await loadDevices({ showLoading: false });
        setSuccess(`Dispositivo "${deviceName}" removido.`);
      }

      if (selectedDeviceId === device.deviceId) {
        setSelectedDeviceId(null);
      }
    } catch (err) {
      setError(err.message || "Não foi possível remover o dispositivo.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="devices-page">
      <header className="devices-header">
        <Link to="/" className="devices-brand" aria-label="Voltar ao início">
          <span className="devices-brand-mark">V.</span>
          <span>
            VINHERIA <strong>FULL</strong>
          </span>
        </Link>

        <nav className="devices-header-nav" aria-label="Navegação">
          <Link to="/mapa">
            <MapPin size={15} />
            Explorar mapa
          </Link>
          <Link to="/">
            <ArrowLeft size={15} />
            Início
          </Link>
        </nav>
      </header>

      <section className="devices-intro">
        <span className="devices-kicker">
          CP5 · EDGE COMPUTING · MONITORAMENTO
        </span>

        <h1>
          Gestão de <em>dispositivos.</em>
        </h1>

        <p>
          Cadastre e acompanhe os dispositivos responsáveis pelo
          monitoramento ambiental das vinherias.
        </p>
      </section>

      <section className="devices-summary" aria-label="Resumo">
        <div className="devices-summary-icon">
          <Cpu size={22} strokeWidth={1.5} />
        </div>

        <div>
          <span>DISPOSITIVOS CADASTRADOS</span>
          <strong>{loading ? "…" : devices.length}</strong>
        </div>

        <button
          className="devices-refresh"
          type="button"
          onClick={() => loadDevices()}
          disabled={loading}
        >
          <RefreshCw
            size={15}
            className={loading ? "devices-spinning" : ""}
          />
          Atualizar lista
        </button>
      </section>

      {error && (
        <div className="devices-message devices-message-error" role="alert">
          <strong>Atenção</strong>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          className="devices-message devices-message-success"
          role="status"
        >
          {success}
        </div>
      )}

      <div className="devices-layout">
        <section className="devices-panel devices-form-panel">
          <div className="devices-panel-heading">
            <span className="devices-section-index">01 — CADASTRO</span>
            <h2>Novo dispositivo</h2>
            <p>
              Escolha o tipo de cadastro e informe os dados do dispositivo.
            </p>
          </div>

          <form className="devices-form" onSubmit={handleSubmit}>
            <label htmlFor="deviceMode">Tipo de cadastro</label>
            <select
              id="deviceMode"
              value={mode}
              onChange={(event) => {
                setMode(event.target.value);
                setError("");
                setSuccess("");
              }}
            >
              <option value="real">Real — integração FIWARE</option>
              <option value="demo">Demonstrativo — dados fictícios</option>
            </select>

            <label htmlFor="deviceId">
              Identificador
              <span className="devices-optional">Opcional</span>
            </label>

            <input
              id="deviceId"
              name="deviceId"
              value={form.deviceId}
              onChange={handleChange}
              placeholder={
                mode === "demo" ? "Ex.: demo-miami" : "Ex.: vinheria001"
              }
              maxLength={64}
              pattern="[A-Za-z0-9_-]{1,64}"
              title="Use letras, números, hífen ou sublinhado."
            />

            <small>
              {mode === "demo"
                ? "Se ficar vazio, será gerado um identificador demonstrativo."
                : "Se ficar vazio, o backend gerará um identificador automaticamente."}
            </small>

            <label htmlFor="displayName">
              Nome do dispositivo <span aria-hidden="true">*</span>
            </label>

            <input
              id="displayName"
              name="displayName"
              value={form.displayName}
              onChange={handleChange}
              placeholder="Ex.: Vinheria Miami"
              maxLength={80}
              required
            />

            <label htmlFor="location">
              Localização <span aria-hidden="true">*</span>
            </label>

            <input
              id="location"
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="Ex.: Miami, Estados Unidos"
              maxLength={120}
              required
            />

            <div className="devices-coordinate-heading">
              <span>Coordenadas geográficas</span>
              <span className="devices-optional">Opcionais</span>
            </div>

            <div className="devices-coordinate-grid">
              <div>
                <label htmlFor="latitude">Latitude</label>
                <input
                  id="latitude"
                  name="latitude"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={form.latitude}
                  onChange={handleChange}
                  placeholder="25.7617"
                />
              </div>

              <div>
                <label htmlFor="longitude">Longitude</label>
                <input
                  id="longitude"
                  name="longitude"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={form.longitude}
                  onChange={handleChange}
                  placeholder="-80.1918"
                />
              </div>
            </div>

            {mode === "demo" && (
              <p className="devices-form-note">
                Para exibir o demonstrativo no mapa, informe latitude e
                longitude. Exemplo de Miami: 25.7617 e -80.1918.
              </p>
            )}

            <button
              className="devices-submit"
              type="submit"
              disabled={submitting}
            >
              <Plus size={17} />
              {submitting
                ? "Cadastrando…"
                : mode === "demo"
                  ? "Cadastrar demonstrativo"
                  : "Cadastrar dispositivo real"}
            </button>

            <p className="devices-form-note">
              {mode === "demo"
                ? "Os dados são fictícios e ficam salvos neste navegador. Não são enviados ao FIWARE."
                : "O cadastro real depende da disponibilidade dos serviços de integração com o FIWARE."}
            </p>
          </form>
        </section>

        <section className="devices-panel devices-list-panel">
          <div className="devices-panel-heading devices-list-heading">
            <div>
              <span className="devices-section-index">02 — INVENTÁRIO</span>
              <h2>Dispositivos registrados</h2>
            </div>
            <span className="devices-count">{devices.length}</span>
          </div>

          {loading ? (
            <div className="devices-empty-state">
              <RefreshCw size={22} className="devices-spinning" />
              <p>Carregando dispositivos…</p>
            </div>
          ) : devices.length === 0 ? (
            <div className="devices-empty-state">
              <Cpu size={28} strokeWidth={1.3} />
              <h3>Nenhum dispositivo encontrado</h3>
              <p>
                Cadastre um dispositivo real ou crie um demonstrativo para
                visualizar dados fictícios.
              </p>
            </div>
          ) : (
            <div className="devices-list">
              {devices.map((device) => (
                <article
                  className="devices-item"
                  key={`${device.isDemo ? "demo" : "real"}-${device.deviceId}`}
                >
                  <div className="devices-item-top">
                    <div className="devices-item-icon">
                      <Cpu size={18} />
                    </div>

                    <div className="devices-item-title">
                      <h3>{device.displayName || device.deviceId}</h3>
                      <span>{device.deviceId}</span>
                      <small>
                        {device.isDemo
                          ? "DADO DEMONSTRATIVO"
                          : "DISPOSITIVO REAL"}
                      </small>
                    </div>

                    <DeviceStatus status={device.status} />
                  </div>

                  <div className="devices-item-location">
                    <MapPin size={14} />
                    {device.location || "Localização não informada"}
                  </div>

                  <div className="devices-readings">
                    <div>
                      <span>Temperatura</span>
                      <strong>
                        {formatValue(device.current?.temperature, " °C")}
                      </strong>
                    </div>

                    <div>
                      <span>Umidade</span>
                      <strong>
                        {formatValue(device.current?.humidity, "%")}
                      </strong>
                    </div>

                    <div>
                      <span>Luminosidade</span>
                      <strong>
                        {formatValue(device.current?.luminosity, "%")}
                      </strong>
                    </div>
                  </div>

                  <div className="devices-item-footer">
                    <span>
                      Última leitura: {formatDate(device.lastSeen)}
                    </span>

                    {!device.isDemo && (
                      <button
                        className="devices-configure"
                        type="button"
                        onClick={() =>
                          setSelectedDeviceId((current) =>
                            current === device.deviceId
                              ? null
                              : device.deviceId
                          )
                        }
                      >
                        {selectedDeviceId === device.deviceId
                          ? "Fechar configurações"
                          : "Configurar alertas"}
                      </button>
                    )}

                    <button
                      className="devices-delete"
                      type="button"
                      onClick={() => handleDelete(device)}
                      disabled={deletingId === device.deviceId}
                      aria-label={`Remover ${device.displayName || device.deviceId}`}
                    >
                      <Trash2 size={15} />
                      {deletingId === device.deviceId
                        ? "Removendo…"
                        : "Remover"}
                    </button>
                  </div>

                  {device.activeAlerts?.length > 0 && (
                    <div className="devices-active-alerts">
                      Alertas ativos: {device.activeAlerts.join(", ")}
                    </div>
                  )}

                  {selectedDeviceId === device.deviceId &&
                    !device.isDemo && (
                      <TriggerSettings device={device} />
                    )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <footer className="devices-footer">
        <span>VINHERIA FULL</span>
        <span>MONITORAMENTO AMBIENTAL · CP5</span>
      </footer>
    </main>
  );
}

export default Devices;
