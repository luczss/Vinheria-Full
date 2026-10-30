
import { useEffect, useState } from "react";
import vinheriaApi from "../services/vinheriaApi";
import "./TriggerSettings.css";

const SENSORS = [
  { key: "temperature", label: "Temperatura", unit: "°C" },
  { key: "humidity", label: "Umidade", unit: "%" },
  { key: "luminosity", label: "Luminosidade", unit: "%" },
];

export default function TriggerSettings({ device }) {
  const [triggers, setTriggers] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadTriggers() {
      try {
        const response = await vinheriaApi.getTriggers(
          device.deviceId
        );

        setTriggers(response?.triggers ?? {});
      } catch (error) {
        console.error(error);
        setMessage("Erro ao carregar os limites.");
      } finally {
        setLoading(false);
      }
    }

    if (device?.deviceId) loadTriggers();
  }, [device?.deviceId]);

  function updateTrigger(sensor, field, value) {
    setTriggers((previous) => ({
      ...previous,
      [sensor]: {
        ...previous[sensor],
        [field]: value,
      },
    }));
  }

  async function saveTriggers() {
    setSaving(true);
    setMessage("");

    try {
      const payload = {};

      for (const sensor of SENSORS) {
        const config = triggers[sensor.key];

        if (!config) {
          throw new Error(
            `Configuração de ${sensor.label} não encontrada.`
          );
        }

        const min = Number(config.min);
        const max = Number(config.max);
        const hysteresis = Number(config.hysteresis);

        if (
          config.min === "" ||
          config.max === "" ||
          config.hysteresis === "" ||
          !Number.isFinite(min) ||
          !Number.isFinite(max) ||
          !Number.isFinite(hysteresis)
        ) {
          throw new Error(
            `Preencha todos os campos de ${sensor.label}.`
          );
        }

        if (min > max) {
          throw new Error(
            `O mínimo de ${sensor.label} não pode ser maior que o máximo.`
          );
        }

        if (
          hysteresis < 0 ||
          hysteresis * 2 > max - min
        ) {
          throw new Error(
            `Histerese inválida para ${sensor.label}.`
          );
        }

        payload[sensor.key] = {
          enabled: config.enabled,
          min,
          max,
          hysteresis,
        };
      }

      const response = await vinheriaApi.updateTriggers(
        device.deviceId,
        payload
      );

      setTriggers(response.triggers);
      setMessage("Limites atualizados com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar triggers:", error);
      setMessage(error.message || "Erro ao salvar os limites.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Carregando configurações...</p>;

  return (
    <section className="trigger-settings">
      <h2>Configuração dos alertas</h2>

      <p>
        Dispositivo: {device.displayName || device.deviceId}
      </p>

      <div className="trigger-grid">
        {SENSORS.map((sensor) => {
          const config = triggers[sensor.key] || {};

          return (
            <article className="trigger-card" key={sensor.key}>
              <h3>{sensor.label}</h3>

              <label>
                <input
                  type="checkbox"
                  checked={config.enabled ?? false}
                  onChange={(event) =>
                    updateTrigger(
                      sensor.key,
                      "enabled",
                      event.target.checked
                    )
                  }
                />
                Monitoramento habilitado
              </label>

              <label>
                Limite mínimo ({sensor.unit})
                <input
                  type="number"
                  value={config.min ?? ""}
                  onChange={(event) =>
                    updateTrigger(
                      sensor.key,
                      "min",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Limite máximo ({sensor.unit})
                <input
                  type="number"
                  value={config.max ?? ""}
                  onChange={(event) =>
                    updateTrigger(
                      sensor.key,
                      "max",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Histerese ({sensor.unit})
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={config.hysteresis ?? ""}
                  onChange={(event) =>
                    updateTrigger(
                      sensor.key,
                      "hysteresis",
                      event.target.value
                    )
                  }
                />
              </label>
            </article>
          );
        })}
      </div>

      <button onClick={saveTriggers} disabled={saving}>
        {saving ? "Salvando..." : "Salvar configurações"}
      </button>

      {message && <p>{message}</p>}
    </section>
  );
}
