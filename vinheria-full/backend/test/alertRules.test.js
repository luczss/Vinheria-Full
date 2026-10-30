const test = require('node:test');
const assert = require('node:assert');
const { planActions, normalizeTriggers } = require('../src/services/alertRules');

const trig = (over = {}) => ({
  temperature: { enabled: true, min: 10, max: 25, hysteresis: 0, ...over },
  humidity: { enabled: true, min: 40, max: 70, hysteresis: 0 },
  luminosity: { enabled: true, min: 20, max: 80, hysteresis: 0 },
});

// Simula a sequência de leituras e aplica as ações como o AlertEngine faz
function run(values, triggers) {
  let alertStates = {};
  const sent = [];
  for (const t of values) {
    const d = { measurements: { temperature: t, humidity: 50, luminosity: 50 }, triggers, alertStates, settings: { autoAlertsEnabled: true } };
    for (const a of planActions(d)) {
      sent.push(`${a.type === 'alert' ? 'alert' : 'clearAlert'}|${a.sensor}`);
      alertStates = { ...alertStates, [a.sensor]: { state: a.type === 'alert' ? 'ALERT_ACTIVE' : 'NORMAL' } };
    }
  }
  return sent;
}

test('envia alert uma única vez ao cruzar o limite e clearAlert ao voltar', () => {
  const sent = run([24, 24, 24, 26, 27, 28, 29, 27, 25, 24], trig());
  assert.deepStrictEqual(sent, ['alert|temperature', 'clearAlert|temperature']);
});

test('histerese mantém o alerta até sair da faixa de folga', () => {
  const sent = run([24, 26, 25, 24.6, 24], trig({ hysteresis: 0.5 }));
  assert.deepStrictEqual(sent, ['alert|temperature', 'clearAlert|temperature']);
  const sent2 = run([24, 26, 25, 24.6], trig({ hysteresis: 0.5 }));
  assert.deepStrictEqual(sent2, ['alert|temperature']); // 25 e 24.6 ainda não limpam
});

test('sensores têm estado independente', () => {
  const d = {
    measurements: { temperature: 30, humidity: 50, luminosity: 90 },
    triggers: trig(),
    alertStates: { temperature: { state: 'ALERT_ACTIVE' }, luminosity: { state: 'ALERT_ACTIVE' } },
    settings: { autoAlertsEnabled: true },
  };
  d.measurements.luminosity = 50; // luminosidade volta, temperatura continua em alerta
  const actions = planActions(d);
  assert.deepStrictEqual(actions.map((a) => `${a.type}|${a.sensor}`), ['clear|luminosity']);
});

test('não faz nada com autoAlertsEnabled=false ou leitura ausente', () => {
  const base = { measurements: { temperature: 99, humidity: null, luminosity: null }, triggers: trig(), alertStates: {} };
  assert.strictEqual(planActions({ ...base, settings: { autoAlertsEnabled: false } }).length, 0);
  assert.deepStrictEqual(planActions({ ...base, settings: { autoAlertsEnabled: true } }).map((a) => a.sensor), ['temperature']);
});

test('trigger desativado limpa alerta ativo', () => {
  const d = { measurements: { temperature: 99, humidity: 50, luminosity: 50 }, triggers: trig({ enabled: false }), alertStates: { temperature: { state: 'ALERT_ACTIVE' } }, settings: {} };
  assert.deepStrictEqual(planActions(d).map((a) => a.type), ['clear']);
});

test('normalizeTriggers valida e mescla parcialmente', () => {
  const merged = normalizeTriggers({ temperature: { max: 30 } }, trig());
  assert.strictEqual(merged.temperature.max, 30);
  assert.strictEqual(merged.humidity.max, 70);
  assert.throws(() => normalizeTriggers({ temperature: { min: 40, max: 30 } }, trig()), /Triggers inválidos/);
  assert.throws(() => normalizeTriggers({ pressure: {} }, trig()), /Triggers inválidos/);
  assert.throws(() => normalizeTriggers({ temperature: { enabled: 'sim' } }, trig()), /Triggers inválidos/);
});
