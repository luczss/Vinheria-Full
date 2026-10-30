// Configuração dos limites (triggers). Persistida como atributo "triggers" na entidade do Orion.
const config = require('../config');
const createLogger = require('../config/logger');
const orion = require('../integrations/OrionClient');
const deviceService = require('./DeviceService');
const alertEngine = require('./AlertEngine');
const { normalizeTriggers } = require('./alertRules');

const log = createLogger('TRIGGER');

async function get(deviceId) {
  const d = await deviceService.getDomain(deviceId);
  return { deviceId, triggers: d.triggers };
}

// PUT: sensores omitidos no body permanecem como estão.
async function put(deviceId, body) {
  const d = await deviceService.getDomain(deviceId);
  const triggers = normalizeTriggers(body, d.triggers);
  await orion.upsertAttrs(d.entityId, { triggers: { type: 'StructuredValue', value: triggers } }, config.fiware.entityType);
  log.info(`${deviceId}: triggers atualizados`, triggers);

  // Aplica já com os novos limites (sem esperar o próximo ciclo de polling)
  let events = [];
  try {
    events = await alertEngine.evaluate({ ...d, triggers });
  } catch (e) {
    log.warn(`${deviceId}: triggers salvos, mas a avaliação imediata falhou: ${e.message}`);
  }
  return { deviceId, triggers, appliedEvents: events };
}

module.exports = { get, put };
