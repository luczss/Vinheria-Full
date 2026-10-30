const config = require('../config');
const pkg = require('../../package.json');
const orion = require('../integrations/OrionClient');
const iota = require('../integrations/IoTAgentClient');
const sth = require('../integrations/SthCometClient');
const tcpCheck = require('../utils/tcpCheck');
const asyncHandler = require('../utils/asyncHandler');

// GET /health — NÃO depende de nenhuma infraestrutura externa
exports.basic = (req, res) => {
  res.json({ status: 'ok', service: 'vinheria-full-backend', version: pkg.version });
};

async function probe(fn) {
  const start = Date.now();
  try {
    const info = await fn();
    return { status: 'up', latencyMs: Date.now() - start, info };
  } catch (e) {
    return { status: 'down', latencyMs: Date.now() - start, error: e.message, code: e.code };
  }
}

// GET /health/dependencies — verifica Orion, IoT Agent, STH-Comet e MQTT (TCP)
exports.dependencies = asyncHandler(async (req, res) => {
  const mqttUrl = new URL(config.mqtt.brokerUrl);
  const [orionR, iotaR, sthR, mqttR] = await Promise.all([
    probe(() => orion.version()),
    probe(() => iota.about()),
    probe(() => sth.version()),
    probe(() => tcpCheck(mqttUrl.hostname, Number(mqttUrl.port) || 1883)),
  ]);
  const dependencies = { orion: orionR, iotAgent: iotaR, sthComet: sthR, mqtt: mqttR };
  const allUp = Object.values(dependencies).every((d) => d.status === 'up');
  res.status(allUp ? 200 : 503).json({ status: allUp ? 'ok' : 'degraded', service: 'vinheria-full-backend', version: pkg.version, dependencies });
});
