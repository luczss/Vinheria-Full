
// Cadastro/consulta de dispositivos. O "banco de dispositivos" é a própria entidade no Orion.
const config = require('../config');
const createLogger = require('../config/logger');
const orion = require('../integrations/OrionClient');
const iota = require('../integrations/IoTAgentClient');
const mapper = require('./entityMapper');
const {
  SENSORS,
  SENSOR_NAMES,
  ACTUATOR_STATES,
  COMMAND_NAMES,
  COMMAND_PARAMS,
} = require('../config/constants');
const {
  AppError,
  ProvisioningError,
  badRequest,
  notFound,
} = require('../utils/errors');
const {
  validateCoordinates,
  nextDeviceId,
} = require('./validators');

const log = createLogger('DEVICE');

const DEVICE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const SAFE_TEXT_RE = /[<>"'=;()]/; // caracteres que o Orion rejeita em valores

function validateDeviceId(deviceId) {
  if (!DEVICE_ID_RE.test(deviceId || '')) {
    throw badRequest(
      'INVALID_DEVICE_ID',
      'deviceId deve ter 1-64 caracteres: letras, números, "_" ou "-"'
    );
  }
}

// ---------- consulta ----------

async function getDomain(deviceId) {
  validateDeviceId(deviceId);

  const raw = await orion.getEntity(
    mapper.entityIdFor(deviceId),
    {
      type: config.fiware.entityType,
      attrs: mapper.DOMAIN_ATTRS,
    }
  );

  if (!raw || !raw.deviceId) {
    throw notFound(`Dispositivo '${deviceId}' não encontrado`);
  }

  return mapper.toDomain(raw);
}

async function listDomain(attrs) {
  const raws = await orion.listEntities({
    type: config.fiware.entityType,
    attrs,
  });

  return raws
    .map(mapper.toDomain)
    .filter((d) => d.deviceId);
}

const activeAlerts = (d) =>
  SENSOR_NAMES.filter(
    (sensor) => d.alertStates?.[sensor]?.state === 'ALERT_ACTIVE'
  );

function summary(d) {
  return {
    deviceId: d.deviceId,
    entityId: d.entityId,
    entityType: d.entityType,
    displayName: d.settings.displayName,
    location: d.settings.location,

    coordinates:
      d.settings.latitude !== null &&
      d.settings.latitude !== undefined &&
      d.settings.longitude !== null &&
      d.settings.longitude !== undefined
        ? {
            latitude: d.settings.latitude,
            longitude: d.settings.longitude,
          }
        : null,

    current: {
      ...d.measurements,
      timestamp: d.timestamp,
    },

    status: mapper.connectionStatus(d.timestamp),
    lastSeen: d.timestamp,
    autoAlertsEnabled: d.settings.autoAlertsEnabled,
    activeAlerts: activeAlerts(d),
  };
}

async function list() {
  // TimeInstant é necessário para calcular status e última leitura.
  const domain = await listDomain(
    'deviceId,settings,temperature,humidity,luminosity,TimeInstant,alertStates'
  );

  return domain.map(summary);
}

async function get(deviceId) {
  const d = await getDomain(deviceId);
  const { apiKey, service, servicePath } = config.fiware;

  return {
    ...summary(d),

    provisioning: {
      protocol: 'PDI-IoTA-UltraLight',
      transport: 'MQTT',
      service,
      servicePath,
      telemetryTopic: `/${apiKey}/${deviceId}/attrs`,
      commandTopic: `/${apiKey}/${deviceId}/cmd`,
      commandAckTopic: `/${apiKey}/${deviceId}/cmdexe`,
    },

    sensors: SENSORS,
    commands: COMMAND_PARAMS,

    current: {
      ...d.measurements,
      timestamp: d.timestamp,
      actuators: d.actuators,
    },
  };
}

// ---------- provisionamento ----------

function buildIotaDevice(deviceId, entityId) {
  return {
    device_id: deviceId,
    entity_name: entityId,
    entity_type: config.fiware.entityType,
    protocol: 'PDI-IoTA-UltraLight',
    transport: 'MQTT',
    timestamp: true,

    commands: COMMAND_NAMES.map((name) => ({
      name,
      type: 'command',
    })),

    attributes: [
      ...Object.entries(SENSORS).map(([name, sensor]) => ({
        object_id: sensor.objectId,
        name,
        type: sensor.type,
      })),

      ...Object.entries(ACTUATOR_STATES).map(
        ([name, objectId]) => ({
          object_id: objectId,
          name,
          type: 'Text',
        })
      ),
    ],
  };
}

// Registration que faz o Orion encaminhar os comandos ao IoT Agent.
// Mesmo formato do passo "4. Registering Smart Lamp Commands" da Postman Collection do professor.
function buildRegistration(entityId) {
  return {
    description: `Comandos ${entityId}`,

    dataProvided: {
      entities: [
        {
          id: entityId,
          type: config.fiware.entityType,
        },
      ],
      attrs: COMMAND_NAMES,
    },

    provider: {
      http: {
        url: config.iotAgent.urlForOrion,
      },
      legacyForwarding: true,
    },
  };
}

const subDescription = (kind, entityId) =>
  `${config.sth.subscriptionId}:${kind}:${entityId}`;

function buildSubscription(kind, entityId) {
  const subject = {
    entities: [
      {
        id: entityId,
        type: config.fiware.entityType,
      },
    ],
    condition: {
      attrs: SENSOR_NAMES,
    },
  };

  if (kind === 'sth') {
    // STH-Comet só entende notificações no formato NGSIv1 ("legacy").
    return {
      description: subDescription(kind, entityId),
      subject,

      notification: {
        http: {
          url: config.sth.notifyUrl,
        },
        attrs: SENSOR_NAMES,
        attrsFormat: 'legacy',
      },
    };
  }

  return {
    description: subDescription(kind, entityId),
    subject,

    notification: {
      http: {
        url: `${config.backendPublicUrl}/api/v1/internal/orion-notifications`,
      },
      attrs: ['deviceId', ...SENSOR_NAMES],
      attrsFormat: 'keyValues',
    },
  };
}

async function ensureRegistration(entityId) {
  const existing = await orion.listRegistrations();

  // O IoT Agent pode já ter registrado os comandos sozinho:
  // nesse caso, não duplicamos o registro.
  const found = existing.some((registration) =>
    (registration.dataProvided?.entities || []).some(
      (entity) => entity.id === entityId
    )
  );

  if (!found) {
    await orion.createRegistration(
      buildRegistration(entityId)
    );
  }

  return {
    created: !found,
  };
}

async function ensureSubscription(kind, entityId) {
  const existing = await orion.listSubscriptions();

  const found = existing.some(
    (subscription) =>
      subscription.description === subDescription(kind, entityId)
  );

  if (!found) {
    await orion.createSubscription(
      buildSubscription(kind, entityId)
    );
  }

  return {
    created: !found,
  };
}

async function ensureEntity(deviceId, entityId, input) {
  const type = config.fiware.entityType;

  const defaults = {
    deviceId: {
      type: 'Text',
      value: deviceId,
    },

    triggers: {
      type: 'StructuredValue',
      value: config.alerts.defaultTriggers,
    },

    settings: {
      type: 'StructuredValue',
      value: {
        ...mapper.DEFAULT_SETTINGS,
        displayName: input.displayName ?? null,
        location: input.location ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
      },
    },

    alertStates: {
      type: 'StructuredValue',
      value: {},
    },

    alertLog: {
      type: 'StructuredValue',
      value: [],
    },
  };

  // A entidade pode existir só "virtualmente" (registration de comandos
  // criada pelo IoT Agent) e ainda não localmente no Orion.
  // Por isso, a sondagem pede só deviceId, atributo que nunca é encaminhado.
  const probe = await orion.getEntity(
    entityId,
    {
      type,
      attrs: 'deviceId',
    }
  );

  if (!probe?.deviceId) {
    try {
      await orion.createEntity({
        id: entityId,
        type,
        ...defaults,
      });

      return;
    } catch (error) {
      if (error.upstreamStatus !== 422) {
        throw error;
      }
      // 422 = já existe localmente (ex.: criada pela primeira telemetria).
    }

    await orion.upsertAttrs(
      entityId,
      defaults,
      type
    );

    return;
  }

  // Já é nossa: completa só o que faltar,
  // sem sobrescrever triggers/settings do usuário.
  const local = await orion.getEntity(
    entityId,
    {
      type,
      attrs: mapper.DOMAIN_ATTRS,
    }
  ) || {};

  const missing = Object.fromEntries(
    Object.entries(defaults).filter(
      ([key]) => local[key] === undefined
    )
  );

  if (Object.keys(missing).length) {
    await orion.upsertAttrs(
      entityId,
      missing,
      type
    );
  }
}

function validateText(field, value, max) {
  if (value === undefined || value === null) {
    return;
  }

  if (
    typeof value !== 'string' ||
    value.length > max ||
    SAFE_TEXT_RE.test(value)
  ) {
    throw badRequest(
      'INVALID_FIELD',
      `${field} deve ser texto de até ${max} caracteres, sem os caracteres < > " ' = ; ( )`
    );
  }
}

async function create(rawInput = {}) {
  // deviceId é opcional: sem ele, o backend gera o próximo livre
  // (vinheria001, vinheria002, ...).
  const deviceId =
    rawInput.deviceId ??
    nextDeviceId(
      (await listDomain('deviceId')).map((d) => d.deviceId),
      config.fiware.deviceIdPrefix
    );

  validateDeviceId(deviceId);
  validateText('displayName', rawInput.displayName, 80);
  validateText('location', rawInput.location, 120);

  const input = {
    ...rawInput,
    ...validateCoordinates(
      rawInput.latitude,
      rawInput.longitude
    ),
  };

  const entityId = mapper.entityIdFor(deviceId);
  const completed = [];

  // Executa uma etapa; se falhar, informa qual etapa
  // e o que já havia sido feito.
  const step = async (name, fn) => {
    try {
      const result = await fn();

      completed.push(name);
      log.info(`${deviceId}: etapa ${name} ok`);

      return result;
    } catch (error) {
      log.error(
        `${deviceId}: etapa ${name} FALHOU: ${error.message}`
      );

      // Erro de regra (ex.: 409), não de integração.
      if (
        error instanceof AppError &&
        !error.details?.service
      ) {
        throw error;
      }

      throw new ProvisioningError(
        name,
        error,
        completed
      );
    }
  };

  await step('PRECHECK', async () => {
    const [entity, iotaDevice] = await Promise.all([
      orion.getEntity(
        entityId,
        {
          type: config.fiware.entityType,
          attrs: 'deviceId',
        }
      ),

      iota.getDevice(deviceId),
    ]);

    if (entity?.deviceId && iotaDevice) {
      throw new AppError(
        409,
        'DEVICE_ALREADY_EXISTS',
        `Dispositivo '${deviceId}' já está cadastrado`
      );
    }
  });

  await step(
    'IOTA_ENSURE_SERVICE_GROUP',
    () =>
      iota.createServiceGroup({
        apikey: config.fiware.apiKey,
        cbroker: config.orion.urlForIotAgent,
        entity_type: config.fiware.entityType,
        resource: '', // MQTT: sem resource.
      })
  );

  await step(
    'IOTA_CREATE_DEVICE',
    () =>
      iota.createDevice(
        buildIotaDevice(deviceId, entityId)
      )
  );

  await step(
    'ORION_ENSURE_ENTITY',
    () =>
      ensureEntity(deviceId, entityId, input)
  );

  await step(
    'ORION_ENSURE_COMMAND_REGISTRATION',
    () =>
      ensureRegistration(entityId)
  );

  await step(
    'ORION_ENSURE_STH_SUBSCRIPTION',
    () =>
      ensureSubscription('sth', entityId)
  );

  if (config.backendPublicUrl) {
    await step(
      'ORION_ENSURE_TRIGGER_SUBSCRIPTION',
      () =>
        ensureSubscription('triggers', entityId)
    );
  }

  return get(deviceId);
}

// ---------- remoção (melhor esforço: tenta tudo e reporta o que falhou) ----------

async function remove(deviceId) {
  validateDeviceId(deviceId);

  const entityId = mapper.entityIdFor(deviceId);
  const type = config.fiware.entityType;

  const [entity, iotaDevice] = await Promise.all([
    orion.getEntity(
      entityId,
      {
        type,
        attrs: 'deviceId',
      }
    ),

    iota.getDevice(deviceId),
  ]);

  if (!entity && !iotaDevice) {
    throw notFound(
      `Dispositivo '${deviceId}' não encontrado`
    );
  }

  const removed = [];
  const warnings = [];

  const attempt = async (name, fn) => {
    try {
      if ((await fn()) !== false) {
        removed.push(name);
      }
    } catch (error) {
      warnings.push({
        step: name,
        message: error.message,
        details: error.details ?? null,
      });

      log.warn(
        `${deviceId}: ${name} falhou: ${error.message}`
      );
    }
  };

  await attempt(
    'IOTA_DELETE_DEVICE',
    () => iota.deleteDevice(deviceId)
  );

  await attempt(
    'ORION_DELETE_REGISTRATIONS',
    async () => {
      const registrations = (
        await orion.listRegistrations()
      ).filter((registration) =>
        (registration.dataProvided?.entities || []).some(
          (entityItem) => entityItem.id === entityId
        )
      );

      for (const registration of registrations) {
        await orion.deleteRegistration(registration.id);
      }

      return registrations.length > 0;
    }
  );

  await attempt(
    'ORION_DELETE_SUBSCRIPTIONS',
    async () => {
      const prefix = `${config.sth.subscriptionId}:`;

      const subscriptions = (
        await orion.listSubscriptions()
      ).filter(
        (subscription) =>
          subscription.description?.startsWith(prefix) &&
          subscription.description.endsWith(`:${entityId}`)
      );

      for (const subscription of subscriptions) {
        await orion.deleteSubscription(subscription.id);
      }

      return subscriptions.length > 0;
    }
  );

  await attempt(
    'ORION_DELETE_ENTITY',
    () => orion.deleteEntity(entityId, type)
  );

  return {
    deviceId,
    removed,
    warnings,
    note: 'O histórico já gravado no STH-Comet não é apagado.',
  };
}

module.exports = {
  getDomain,
  listDomain,
  list,
  get,
  create,
  remove,
  validateDeviceId,
  validateText,
};
