// Tratamento global de erros: JSON padronizado, sem stack trace em produção.
const config = require('../config');
const createLogger = require('../config/logger');
const { AppError } = require('../utils/errors');

const log = createLogger('API');

function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: `Rota não encontrada: ${req.method} ${req.originalUrl}` } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Erro interno do servidor';
  let details;

  if (err instanceof AppError) {
    ({ status, code, message, details } = err);
  } else if (err.type === 'entity.parse.failed') {
    status = 400; code = 'INVALID_JSON'; message = 'Body não é um JSON válido';
  } else if (!config.isProduction) {
    message = err.message;
  }

  (status >= 500 ? log.error : log.warn)(`${req.method} ${req.originalUrl} -> ${status} ${code}: ${message}`);
  if (status >= 500 && !(err instanceof AppError)) log.error(err.stack);

  const body = { error: { code, message } };
  if (details !== undefined) body.error.details = details; // inclui o erro original do FIWARE
  if (!config.isProduction && status >= 500 && !(err instanceof AppError)) body.error.stack = err.stack;
  res.status(status).json(body);
}

module.exports = { errorHandler, notFoundHandler };
