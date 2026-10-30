// MOTOR DE ALERTAS: aplica os triggers no backend e envia comandos SOMENTE em mudança de estado.
// Entradas: polling periódico no Orion e (opcional) notificações de subscription.
// Estado por sensor (alertStates) e histórico (alertLog) ficam na entidade do Orion.
const { randomUUID } = require('crypto');
const config = require('../config');
const createLogger = require('../config/logger');
const orion = require('../integrations/OrionClient');
const deviceService = require('./DeviceService');
const commandService = require('./CommandService');
const mapper = require('./entityMapper');
const { planActions } = require('./alertRules');
const { SENSOR_NAMES, ALERT_STATE } = require('../config/constants');

const log = createLogger('TRIGGER');
const locks = new Map();

// Serializa avaliações do mesmo dispositivo (polling x notificação) para não duplicar comandos.
function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  locks.set(key, tail);
  tail.then(() => { if (locks.get(key) === tail) locks.delete(key); });
  return run;
}

async function execute(d, actions) {
  const states = { ...d.alertStates };
  const events = [];
  for (const a of actions) {
    const command = a.type === 'alert' ? 'alert' : 'clearAlert';
    try {
      await commandService.dispatch({ deviceId: d.deviceId, entityId: d.entityId, entityType: d.entityType, command, parameter: a.sensor });
    } catch (e) {
      // estado NÃO muda: a próxima avaliação tenta de novo
      log.error(`${d.deviceId}: falha ao enviar ${command}|${a.sensor}: ${e.message}`);
      continue;
    }
    const now = new Date().toISOString();
    const cfg = d.triggers[a.sensor];
    states[a.sensor] = { state: a.type === 'alert' ? ALERT_STATE.ACTIVE : ALERT_STATE.NORMAL, since: now, lastValue: a.value };
    events.push({
      id: randomUUID(),
      sensor: a.sensor,
      event: a.type === 'alert' ? 'ALERT_ACTIVATED' : 'ALERT_CLEARED',
      reason: a.reason,
      value: a.value,
      limits: { min: cfg.min, max: cfg.max },
      command: `${command}|${a.sensor}`,
      timestamp: now,
    });
    log.info(`${d.deviceId}: ${a.sensor} -> ${states[a.sensor].state} (valor=${a.value}, ${a.reason})`);
  }
  if (!events.length) return [];
  const alertLog = [...events.reverse(), ...d.alertLog].slice(0, config.alerts.logSize);
  await orion.upsertAttrs(d.entityId, {
    alertStates: { type: 'StructuredValue', value: states },
    alertLog: { type: 'StructuredValue', value: alertLog },
  }, d.entityType);
  return events;
}

// d: dispositivo no modelo de domínio (entityMapper.toDomain)
async function evaluate(d) {
  if (!d || !d.deviceId) return [];
  if (planActions(d).length === 0) return []; // caminho rápido: nada a fazer
  return withLock(d.deviceId, async () => {
    // relê dentro do lock: o estado pode ter mudado desde a leitura do chamador
    const raw = await orion.getEntity(d.entityId, { type: d.entityType, attrs: mapper.DOMAIN_ATTRS });
    if (!raw) return [];
    const fresh = mapper.toDomain(raw);
    const actions = planActions(fresh);
    return actions.length ? execute(fresh, actions) : [];
  });
}

async function evaluateEntityId(entityId, type) {
  const raw = await orion.getEntity(entityId, { type, attrs: mapper.DOMAIN_ATTRS });
  if (raw) await evaluate(mapper.toDomain(raw));
}

async function getAlerts(deviceId, { limit = 20 } = {}) {
  const d = await deviceService.getDomain(deviceId);
  const active = SENSOR_NAMES
    .filter((s) => d.alertStates[s]?.state === ALERT_STATE.ACTIVE)
    .map((s) => ({ sensor: s, since: d.alertStates[s].since, value: d.alertStates[s].lastValue, limits: { min: d.triggers[s].min, max: d.triggers[s].max } }));
  return { deviceId, active, history: d.alertLog.slice(0, limit) };
}

function startPolling() {
  if (!config.alerts.pollEnabled) {
    log.info('polling desligado (ALERT_POLL_ENABLED=false)');
    return () => {};
  }
  const intervalMs = config.alerts.pollIntervalSeconds * 1000;
  let timer;
  let stopped = false;
  const tick = async () => {
    try {
      const devices = await deviceService.listDomain('deviceId,settings,triggers,alertStates,temperature,humidity,luminosity');
      for (const d of devices) {
        await evaluate(d).catch((e) => log.error(`${d.deviceId}: avaliação falhou: ${e.message}`));
      }
    } catch (e) {
      log.warn(`polling falhou: ${e.message}`);
    } finally {
      if (!stopped) timer = setTimeout(tick, intervalMs);
    }
  };
  timer = setTimeout(tick, 2000);
  log.info(`polling ativo a cada ${config.alerts.pollIntervalSeconds}s`);
  return () => { stopped = true; clearTimeout(timer); };
}

module.exports = { evaluate, evaluateEntityId, getAlerts, startPolling };
