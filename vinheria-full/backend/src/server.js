const app = require('./app');
const config = require('./config');
const createLogger = require('./config/logger');
const alertEngine = require('./services/AlertEngine');

const log = createLogger('API');

const server = app.listen(config.port, () => {
  log.info(`vinheria-full-backend escutando na porta ${config.port} (${config.nodeEnv})`);
  log.info('FIWARE', {
    orion: config.orion.url,
    iotAgent: config.iotAgent.url,
    sthComet: config.sth.url,
    mqtt: config.mqtt.brokerUrl,
    service: config.fiware.service,
    servicePath: config.fiware.servicePath,
  });
});
const stopPolling = alertEngine.startPolling();

function shutdown(signal) {
  log.info(`${signal} recebido, encerrando...`);
  stopPolling();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
