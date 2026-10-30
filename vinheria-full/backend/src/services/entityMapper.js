
// Traduz a entidade NGSIv2 do Orion para o modelo simples da API
// e deriva o entityId do deviceId.
// É aqui que contextElement / object_id / NGSI deixam de existir para o frontend.

const config = require('../config');
const { SENSOR_NAMES, ACTUATOR_STATES } = require('../config/constants');

const clone = (o) => JSON.parse(JSON.stringify(o));

// Atributos locais da entidade, incluindo o TimeInstant.
const DOMAIN_ATTRS = [
  'deviceId',
  ...SENSOR_NAMES,
  ...Object.keys(ACTUATOR_STATES),
  'TimeInstant',
  'triggers',
  'settings',
  'alertStates',
  'alertLog'
].join(',');

const DEFAULT_SETTINGS = {
  displayName: null,
  location: null,
  latitude: null,
  longitude: null,
  autoAlertsEnabled: true
};

// vinheria001 -> urn:ngsi-ld:VinheriaDevice:001
// vinheria002 -> urn:ngsi-ld:VinheriaDevice:002
// "abc" -> urn:ngsi-ld:VinheriaDevice:abc
function entityIdFor(deviceId) {
  const { deviceIdPrefix, entityUrnPrefix } = config.fiware;

  const suffix =
    deviceId.startsWith(deviceIdPrefix) &&
    deviceId.length > deviceIdPrefix.length
      ? deviceId.slice(deviceIdPrefix.length)
      : deviceId;

  return `${entityUrnPrefix}${suffix}`;
}

const attrValue = (entity, name) =>
  entity && entity[name] !== undefined
    ? entity[name].value
    : undefined;

const toNumber = (v) => {
  if (v === undefined || v === null || v === '') return null;

  const n = Number(v);

  return Number.isFinite(n) ? n : null;
};

function toDomain(entity) {
  const measurements = {};

  // O IoT Agent pode disponibilizar TimeInstant como atributo próprio
  // da entidade ou como metadado dos atributos dos sensores.
  let timestamp = entity?.TimeInstant?.value ?? null;

  for (const s of SENSOR_NAMES) {
    measurements[s] = toNumber(attrValue(entity, s));

    // Compatibilidade com TimeInstant armazenado nos metadados.
    const t = entity?.[s]?.metadata?.TimeInstant?.value;

    if (
      t &&
      (!timestamp || Date.parse(t) > Date.parse(timestamp))
    ) {
      timestamp = t;
    }
  }

  const actuators = {};

  for (const k of Object.keys(ACTUATOR_STATES)) {
    actuators[k] = attrValue(entity, k) ?? null;
  }

  const storedTriggers = attrValue(entity, 'triggers') || {};
  const triggers = {};

  for (const s of SENSOR_NAMES) {
    triggers[s] = {
      ...config.alerts.defaultTriggers[s],
      ...(storedTriggers[s] || {})
    };
  }

  const log = attrValue(entity, 'alertLog');

  return {
    deviceId: attrValue(entity, 'deviceId') ?? null,
    entityId: entity.id,
    entityType: entity.type,
    measurements,
    timestamp,
    actuators,
    triggers,
    settings: {
      ...DEFAULT_SETTINGS,
      ...(attrValue(entity, 'settings') || {})
    },
    alertStates: attrValue(entity, 'alertStates') || {},
    alertLog: Array.isArray(log) ? log : [],
  };
}

function connectionStatus(timestamp) {
  if (!timestamp) return 'unknown';

  const ageMs = Date.now() - Date.parse(timestamp);

  return ageMs <= config.devices.onlineTimeoutSeconds * 1000
    ? 'online'
    : 'offline';
}

module.exports = {
  entityIdFor,
  toDomain,
  connectionStatus,
  clone,
  DEFAULT_SETTINGS,
  DOMAIN_ATTRS
};
