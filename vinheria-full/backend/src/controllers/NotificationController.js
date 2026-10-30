// Recebe notificações NGSIv2 (keyValues) de uma subscription do Orion — opcional (BACKEND_PUBLIC_URL).
const createLogger = require('../config/logger');
const alertEngine = require('../services/AlertEngine');

const log = createLogger('TRIGGER');

exports.orionNotification = (req, res) => {
  res.status(200).json({ received: true }); // responde logo: o Orion não deve esperar o processamento
  const items = Array.isArray(req.body?.data) ? req.body.data : [];
  for (const item of items) {
    if (!item?.id) continue;
    alertEngine.evaluateEntityId(item.id, item.type).catch((e) => log.error(`notificação ${item.id}: ${e.message}`));
  }
};
