// ============================================================================
// CONFIGURAÇÃO CENTRAL — única porta de entrada de variáveis de ambiente.
// Para alterar IPs/portas/chaves edite backend/.env (NÃO este arquivo).
// ============================================================================
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { SENSOR_NAMES } = require('./constants');

const env = (key, fallback) => {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
};
const num = (key, fallback) => {
  const n = Number(env(key, fallback));
  return Number.isFinite(n) ? n : fallback;
};
const bool = (key, fallback) => String(env(key, fallback)).toLowerCase() === 'true';
const url = (key, fallback) => String(env(key, fallback)).replace(/\/+$/, '');

// Valores de fallback = ambiente local típico. Em outro ambiente, defina no .env.
const TRIGGER_FALLBACK = { temperature: [10, 25], humidity: [40, 70], luminosity: [20, 80] };
const defaultTriggers = {};
for (const s of SENSOR_NAMES) {
  const K = `TRIGGER_DEFAULT_${s.toUpperCase()}`;
  defaultTriggers[s] = {
    enabled: bool(`${K}_ENABLED`, true),
    min: num(`${K}_MIN`, TRIGGER_FALLBACK[s][0]),
    max: num(`${K}_MAX`, TRIGGER_FALLBACK[s][1]),
    hysteresis: num(`${K}_HYSTERESIS`, 0),
  };
}

// FIWARE_HOST: troque SÓ esta linha quando o IP da VM mudar. As URLs explícitas (ORION_URL, ...) têm prioridade.
const host = env('FIWARE_HOST', '');
const fromHost = (port, fallback) => (host ? `http://${host}:${port}` : fallback);

const nodeEnv = env('NODE_ENV', 'development');

module.exports = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: num('PORT', 3000), // .env -> PORT
  logLevel: env('LOG_LEVEL', 'info'),
  corsOrigin: env('CORS_ORIGIN', '*'),
  requestTimeoutMs: num('REQUEST_TIMEOUT_MS', 8000),

  fiware: {
    service: env('FIWARE_SERVICE', 'smart'),
    servicePath: env('FIWARE_SERVICEPATH', '/'),
    apiKey: env('FIWARE_APIKEY', 'TEF'),
    entityType: env('FIWARE_ENTITY_TYPE', 'VinheriaDevice'),
    entityUrnPrefix: env('ENTITY_URN_PREFIX', 'urn:ngsi-ld:VinheriaDevice:'),
    deviceIdPrefix: env('DEVICE_ID_PREFIX', 'vinheria'),
  },
  orion: {
    url: url('ORION_URL', fromHost(1026, 'http://localhost:1026')), // .env -> FIWARE_HOST ou ORION_URL
    urlForIotAgent: url('ORION_URL_FOR_IOTA', 'http://orion:1026'), // = IOTA_CB_HOST/PORT do docker-compose
  },
  iotAgent: {
    url: url('IOTA_URL', fromHost(4041, 'http://localhost:4041')), // .env -> FIWARE_HOST ou IOTA_URL
    urlForOrion: url('IOTA_URL_FOR_ORION', 'http://iot-agent:4041'), // = IOTA_PROVIDER_URL do docker-compose
  },
  sth: {
    url: url('STH_URL', fromHost(8666, 'http://localhost:8666')), // .env -> FIWARE_HOST ou STH_URL
    notifyUrl: env('STH_NOTIFY_URL', 'http://fiware-sth-comet:8666/notify'), // nome do serviço no docker-compose do professor
    subscriptionId: env('STH_SUBSCRIPTION_ID', 'vinheria-full-sth-subscription'),
    defaultLastN: num('HISTORY_DEFAULT_LAST_N', 50),
    maxPoints: num('HISTORY_MAX_POINTS', 100),
  },
  mqtt: { brokerUrl: env('MQTT_BROKER_URL', host ? `mqtt://${host}:1883` : 'mqtt://localhost:1883') }, // .env -> FIWARE_HOST ou MQTT_BROKER_URL

  backendPublicUrl: url('BACKEND_PUBLIC_URL', ''),
  devices: { onlineTimeoutSeconds: num('DEVICE_ONLINE_TIMEOUT_SECONDS', 120) },
  alerts: {
    pollEnabled: bool('ALERT_POLL_ENABLED', true),
    pollIntervalSeconds: num('ALERT_POLL_INTERVAL_SECONDS', 10),
    logSize: num('ALERT_LOG_SIZE', 50),
    defaultTriggers,
  },
};
