// Erros da aplicação. O errorHandler transforma qualquer um deles em JSON padronizado.

class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Falha ao falar com Orion / IoT Agent / STH-Comet. Nunca esconde o erro original do FIWARE.
class UpstreamError extends AppError {
  constructor(service, info) {
    const { status, data, code, timeout, url } = info;
    let httpStatus = 502;
    let errCode = 'UPSTREAM_ERROR';
    let message;
    if (status !== undefined) {
      message = `${service} respondeu HTTP ${status} em ${url}`;
    } else if (timeout) {
      httpStatus = 504;
      errCode = 'UPSTREAM_TIMEOUT';
      message = `Timeout ao chamar ${service} (${url})`;
    } else {
      errCode = 'UPSTREAM_UNREACHABLE';
      message = `Não foi possível conectar a ${service} (${code}). Verifique a URL no .env (${url})`;
    }
    super(httpStatus, errCode, message, {
      service,
      upstreamStatus: status ?? null,
      upstreamBody: data ?? null,
      upstreamCode: code ?? null,
    });
    this.service = service;
    this.upstreamStatus = status;
  }
}

// Falha no meio do provisionamento: informa a etapa e o que já foi feito.
class ProvisioningError extends AppError {
  constructor(step, cause, completedSteps) {
    const status = cause instanceof AppError && cause.status >= 500 ? cause.status : 502;
    super(status, 'PROVISIONING_FAILED', `Falha na etapa ${step}: ${cause.message}`, {
      step,
      completedSteps,
      cause: cause.details ?? null,
    });
  }
}

const badRequest = (code, message, details) => new AppError(400, code, message, details);
const notFound = (message) => new AppError(404, 'NOT_FOUND', message);

module.exports = { AppError, UpstreamError, ProvisioningError, badRequest, notFound };
