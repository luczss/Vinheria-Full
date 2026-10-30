// Medições atuais (Orion) e histórico (STH-Comet), já normalizados para o frontend.
const config = require('../config');
const sth = require('../integrations/SthCometClient');
const deviceService = require('./DeviceService');
const mapper = require('./entityMapper');
const { SENSORS, SENSOR_NAMES } = require('../config/constants');
const { badRequest } = require('../utils/errors');

async function current(deviceId) {
  const d = await deviceService.getDomain(deviceId);
  return {
    deviceId: d.deviceId,
    temperature: d.measurements.temperature,
    humidity: d.measurements.humidity,
    luminosity: d.measurements.luminosity,
    timestamp: d.timestamp,
    status: mapper.connectionStatus(d.timestamp),
    units: Object.fromEntries(SENSOR_NAMES.map((s) => [s, SENSORS[s].unit])),
    actuators: d.actuators,
  };
}

const intParam = (name, v, min, max) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw badRequest('INVALID_QUERY', `${name} deve ser inteiro entre ${min} e ${max}`);
  return n;
};
const dateParam = (name, v) => {
  if (Number.isNaN(Date.parse(v))) throw badRequest('INVALID_QUERY', `${name} deve ser data ISO 8601`);
  return new Date(v).toISOString();
};

// query: attribute? | lastN? | from?, to?, limit?, offset?
async function history(deviceId, query = {}) {
  const d = await deviceService.getDomain(deviceId);
  const { attribute, lastN, from, to, limit, offset } = query;

  if (attribute && !SENSOR_NAMES.includes(attribute)) {
    throw badRequest('INVALID_QUERY', `attribute deve ser um de: ${SENSOR_NAMES.join(', ')}`);
  }
  const attributes = attribute ? [attribute] : SENSOR_NAMES;
  const max = config.sth.maxPoints;

  const params = {};
  if (from || to) {
    if (from) params.dateFrom = dateParam('from', from);
    if (to) params.dateTo = dateParam('to', to);
    params.hLimit = limit !== undefined ? intParam('limit', limit, 1, max) : max;
    params.hOffset = offset !== undefined ? intParam('offset', offset, 0, 1e9) : 0;
  } else {
    params.lastN = lastN !== undefined ? intParam('lastN', lastN, 1, max) : Math.min(config.sth.defaultLastN, max);
  }

  const entries = await Promise.all(attributes.map(async (attr) => [
    attr,
    await sth.getAttributeHistory({ entityType: d.entityType, entityId: d.entityId, attribute: attr, ...params }),
  ]));
  const series = Object.fromEntries(entries);
  return {
    deviceId,
    units: Object.fromEntries(attributes.map((a) => [a, SENSORS[a].unit])),
    series,
    count: Object.fromEntries(entries.map(([a, pts]) => [a, pts.length])),
  };
}

module.exports = { current, history };
