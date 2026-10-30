// REGRA DE NEGÓCIO PURA (sem I/O): validação de triggers e máquina de estados dos alertas.
// Cada sensor tem estado independente: NORMAL <-> ALERT_ACTIVE.
const { SENSOR_NAMES, ALERT_STATE } = require('../config/constants');
const { badRequest } = require('../utils/errors');

const TRIGGER_KEYS = ['enabled', 'min', 'max', 'hysteresis'];
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// Mescla `input` (parcial ou completo) sobre `current` e valida. Sensores omitidos ficam como estão.
function normalizeTriggers(input, current) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw badRequest('INVALID_TRIGGERS', 'O body deve ser um objeto com as chaves temperature, humidity e/ou luminosity');
  }
  const result = JSON.parse(JSON.stringify(current));
  const errors = [];
  for (const [sensor, cfg] of Object.entries(input)) {
    if (!SENSOR_NAMES.includes(sensor)) { errors.push(`sensor desconhecido: ${sensor}`); continue; }
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) { errors.push(`${sensor}: deve ser um objeto`); continue; }
    const unknown = Object.keys(cfg).filter((k) => !TRIGGER_KEYS.includes(k));
    if (unknown.length) errors.push(`${sensor}: campos desconhecidos (${unknown.join(', ')})`);
    const m = { ...result[sensor], ...cfg };
    if (typeof m.enabled !== 'boolean') errors.push(`${sensor}.enabled deve ser boolean`);
    if (!isNum(m.min)) errors.push(`${sensor}.min deve ser número`);
    if (!isNum(m.max)) errors.push(`${sensor}.max deve ser número`);
    if (isNum(m.min) && isNum(m.max) && m.min > m.max) errors.push(`${sensor}: min não pode ser maior que max`);
    if (!isNum(m.hysteresis) || m.hysteresis < 0) errors.push(`${sensor}.hysteresis deve ser número >= 0`);
    else if (isNum(m.min) && isNum(m.max) && m.hysteresis * 2 > m.max - m.min) errors.push(`${sensor}.hysteresis é grande demais para o intervalo min..max`);
    result[sensor] = { enabled: m.enabled, min: m.min, max: m.max, hysteresis: m.hysteresis };
  }
  if (errors.length) throw badRequest('INVALID_TRIGGERS', 'Triggers inválidos', { errors });
  return result;
}

// Decide quais comandos devem ser enviados AGORA. Só devolve ação em MUDANÇA de estado:
//   NORMAL + fora do intervalo            -> alert
//   ALERT_ACTIVE + de volta (com histerese) -> clear
// d = { measurements, triggers, alertStates, settings }
function planActions(d) {
  const actions = [];
  if (d.settings && d.settings.autoAlertsEnabled === false) return actions;
  for (const sensor of SENSOR_NAMES) {
    const cfg = d.triggers[sensor];
    const state = d.alertStates?.[sensor]?.state || ALERT_STATE.NORMAL;
    const value = d.measurements[sensor];

    if (!cfg || !cfg.enabled) {
      if (state === ALERT_STATE.ACTIVE) actions.push({ sensor, type: 'clear', reason: 'TRIGGER_DISABLED', value });
      continue;
    }
    if (value === null || value === undefined) continue;

    const h = cfg.hysteresis || 0;
    if (state === ALERT_STATE.NORMAL && (value < cfg.min || value > cfg.max)) {
      actions.push({ sensor, type: 'alert', reason: value > cfg.max ? 'ABOVE_MAX' : 'BELOW_MIN', value });
    } else if (state === ALERT_STATE.ACTIVE && value >= cfg.min + h && value <= cfg.max - h) {
      actions.push({ sensor, type: 'clear', reason: 'BACK_TO_NORMAL', value });
    }
  }
  return actions;
}

module.exports = { normalizeTriggers, planActions };
