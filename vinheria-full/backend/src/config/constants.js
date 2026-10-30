// Modelo fixo do dispositivo Vinheria (NÃO depende de um deviceId específico).

// Sensores: nome do atributo NGSI -> object_id do Ultralight
const SENSORS = {
  temperature: { objectId: 't', type: 'Float', unit: '°C' },
  humidity: { objectId: 'h', type: 'Float', unit: '%' },
  luminosity: { objectId: 'l', type: 'Integer', unit: '0-100' },
};
const SENSOR_NAMES = Object.keys(SENSORS);

// Estados informados pelo dispositivo (todos Text)
const ACTUATOR_STATES = { ledState: 's', buzzerState: 'b', displayState: 'd', alertType: 'a' };

// Comandos aceitos e parâmetros válidos de cada um
const COMMAND_PARAMS = {
  alert: SENSOR_NAMES,
  clearAlert: SENSOR_NAMES, // sempre por sensor: nunca limpa alertas de outros sensores
  displayAlert: [...SENSOR_NAMES, 'clear'],
};
const COMMAND_NAMES = Object.keys(COMMAND_PARAMS);

const ALERT_STATE = { NORMAL: 'NORMAL', ACTIVE: 'ALERT_ACTIVE' };

module.exports = { SENSORS, SENSOR_NAMES, ACTUATOR_STATES, COMMAND_PARAMS, COMMAND_NAMES, ALERT_STATE };
