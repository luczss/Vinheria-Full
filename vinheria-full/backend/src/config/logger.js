// Logger mínimo com tag por componente: [ORION] [IOT_AGENT] [STH_COMET] [MQTT] [TRIGGER] [DEVICE] ...
const config = require('./index');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

module.exports = function createLogger(tag) {
  const emit = (level, message, meta) => {
    if (LEVELS[level] > (LEVELS[config.logLevel] ?? LEVELS.info)) return;
    let line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${tag}] ${message}`;
    if (meta !== undefined) {
      try { line += ` ${JSON.stringify(meta)}`; } catch (_) { /* ignora meta não serializável */ }
    }
    (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
  };
  return {
    error: (m, x) => emit('error', m, x),
    warn: (m, x) => emit('warn', m, x),
    info: (m, x) => emit('info', m, x),
    debug: (m, x) => emit('debug', m, x),
  };
};
