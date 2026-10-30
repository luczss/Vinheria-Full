// Configurações do dispositivo (nome, local, alertas automáticos) — atributo "settings" no Orion.
const config = require('../config');
const orion = require('../integrations/OrionClient');
const deviceService = require('./DeviceService');
const { badRequest } = require('../utils/errors');
const { validateCoordinatesPatch } = require('./validators');

const ALLOWED = ['displayName', 'location', 'latitude', 'longitude', 'autoAlertsEnabled'];

async function get(deviceId) {
  const d = await deviceService.getDomain(deviceId);
  return { deviceId, settings: d.settings };
}

async function patch(deviceId, body = {}) {
  const d = await deviceService.getDomain(deviceId);
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length === 0) {
    throw badRequest('INVALID_SETTINGS', `Envie ao menos um campo entre: ${ALLOWED.join(', ')}`);
  }
  const unknown = Object.keys(body).filter((k) => !ALLOWED.includes(k));
  if (unknown.length) throw badRequest('INVALID_SETTINGS', `Campos desconhecidos: ${unknown.join(', ')}`);
  deviceService.validateText('displayName', body.displayName, 80);
  deviceService.validateText('location', body.location, 120);
  if (body.autoAlertsEnabled !== undefined && typeof body.autoAlertsEnabled !== 'boolean') {
    throw badRequest('INVALID_SETTINGS', 'autoAlertsEnabled deve ser boolean');
  }
  const settings = { ...d.settings, ...body };
  const coords = validateCoordinatesPatch(body); // se vier uma coordenada, a outra também precisa vir
  if (coords) Object.assign(settings, coords);
  await orion.upsertAttrs(d.entityId, { settings: { type: 'StructuredValue', value: settings } }, config.fiware.entityType);
  return { deviceId, settings };
}

module.exports = { get, patch };
