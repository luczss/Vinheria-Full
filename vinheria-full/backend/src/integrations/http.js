// Fábrica de clientes HTTP (axios) para os serviços FIWARE.
// Converte qualquer falha em UpstreamError e registra logs com a tag do serviço.
const axios = require('axios');
const config = require('../config');
const createLogger = require('../config/logger');
const { UpstreamError } = require('../utils/errors');

function fiwareHeaders() {
  return {
    'fiware-service': config.fiware.service,
    'fiware-servicepath': config.fiware.servicePath,
  };
}

function createHttp(tag, baseURL) {
  const log = createLogger(tag);
  const instance = axios.create({ baseURL, timeout: config.requestTimeoutMs });

  instance.interceptors.request.use((req) => {
    req.metadata = { start: Date.now() };
    return req;
  });

  instance.interceptors.response.use(
    (res) => {
      log.debug(`${res.config.method.toUpperCase()} ${res.config.url} -> ${res.status} (${Date.now() - res.config.metadata.start}ms)`);
      return res;
    },
    (error) => {
      const cfg = error.config || {};
      const label = `${(cfg.method || '?').toUpperCase()} ${cfg.baseURL || ''}${cfg.url || ''}`;
      if (error.response) {
        // 404 é esperado em consultas ("não existe") -> só debug
        (error.response.status === 404 ? log.debug : log.warn)(`${label} -> ${error.response.status}`, error.response.data);
        return Promise.reject(new UpstreamError(tag, { status: error.response.status, data: error.response.data, url: label }));
      }
      const timeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
      log.error(`${label} -> ${error.code || error.message}`);
      return Promise.reject(new UpstreamError(tag, { code: error.code || 'UNKNOWN', timeout, url: label }));
    },
  );
  return instance;
}

module.exports = { createHttp, fiwareHeaders };
