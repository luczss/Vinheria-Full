// Envio de comandos ao dispositivo: Orion (atributo type=command) -> registration -> IoT Agent -> MQTT.
// O backend só diz O QUÊ (alert|temperature); COMO o hardware reage é decisão do firmware.
const config = require('../config');
const createLogger = require('../config/logger');
const orion = require('../integrations/OrionClient');
const deviceService = require('./DeviceService');
const { COMMAND_PARAMS, COMMAND_NAMES } = require('../config/constants');
const { badRequest } = require('../utils/errors');

const log = createLogger('DEVICE');

function validateCommand(command, parameter) {
  if (!COMMAND_NAMES.includes(command)) {
    throw badRequest('INVALID_COMMAND', `command deve ser um de: ${COMMAND_NAMES.join(', ')}`);
  }
  if (!COMMAND_PARAMS[command].includes(parameter)) {
    throw badRequest('INVALID_PARAMETER', `Para '${command}', parameter deve ser um de: ${COMMAND_PARAMS[command].join(', ')}`);
  }
}

// Baixo nível: usado pela API e pelo motor de alertas.
async function dispatch({ deviceId, entityId, entityType, command, parameter }) {
  validateCommand(command, parameter);
  await orion.updateAttrs(entityId, { [command]: { type: 'command', value: parameter } }, entityType);
  log.info(`${deviceId}: comando enviado ao Orion -> ${deviceId}@${command}|${parameter}`);
  return { deviceId, command, parameter, mqttMessage: `${deviceId}@${command}|${parameter}`, sentAt: new Date().toISOString() };
}

async function send(deviceId, body = {}) {
  validateCommand(body.command, body.parameter);
  const d = await deviceService.getDomain(deviceId);
  const result = await dispatch({ deviceId, entityId: d.entityId, entityType: config.fiware.entityType, command: body.command, parameter: body.parameter });
  // "SENT_TO_FIWARE": o Orion aceitou o comando. A entrega ao ESP32 não é confirmada aqui.
  return { ...result, status: 'SENT_TO_FIWARE' };
}

module.exports = { dispatch, send };
