// Encapsula chamadas HTTP ao Orion Context Broker (NGSIv2). Nenhuma regra de negócio aqui.
const config = require('../config');
const { createHttp, fiwareHeaders } = require('./http');

const http = createHttp('ORION', config.orion.url);
const enc = encodeURIComponent;
const idFromLocation = (res) => String(res.headers?.location || '').split('/').pop() || null;
const ignore404 = (fallback) => (e) => {
  if (e.upstreamStatus === 404) return fallback;
  throw e;
};

class OrionClient {
  async version() {
    return (await http.get('/version')).data;
  }

  // ---- Entidades ----
  // `attrs` restringe os atributos devolvidos. Pedir atributos que NÃO são comandos evita que o Orion
  // encaminhe a consulta ao IoT Agent (registration) e "enxergue" entidades que só existem lá.
  async getEntity(id, { type, attrs } = {}) {
    return http
      .get(`/v2/entities/${enc(id)}`, { headers: fiwareHeaders(), params: { type, attrs } })
      .then((r) => r.data)
      .catch(ignore404(null));
  }

  async listEntities({ type, attrs, limit = 1000, offset = 0 } = {}) {
    const r = await http.get('/v2/entities', { headers: fiwareHeaders(), params: { type, attrs, limit, offset } });
    return r.data;
  }

  async createEntity(entity) {
    await http.post('/v2/entities', entity, { headers: fiwareHeaders() });
  }

  // POST /attrs = "append or update": cria o atributo se não existir. Também serve para
  // enviar comandos (atributos type=command), que o Orion encaminha via registration.
  async upsertAttrs(id, attrs, type) {
    await http.post(`/v2/entities/${enc(id)}/attrs`, attrs, { headers: fiwareHeaders(), params: { type } });
  }

  // PATCH /attrs, igual ao passo "6. Switching on the Smart Lamp" da collection do professor.
  // Usado para comandos: o Orion encaminha ao IoT Agent via registration (e falha com 404
  // em vez de criar o atributo localmente se algo estiver errado no registro).
  async updateAttrs(id, attrs, type) {
    await http.patch(`/v2/entities/${enc(id)}/attrs`, attrs, { headers: fiwareHeaders(), params: { type } });
  }

  async deleteEntity(id, type) {
    return http
      .delete(`/v2/entities/${enc(id)}`, { headers: fiwareHeaders(), params: { type } })
      .then(() => true)
      .catch(ignore404(false));
  }

  // ---- Registrations (encaminhamento de comandos para o IoT Agent) ----
  async listRegistrations() {
    return (await http.get('/v2/registrations', { headers: fiwareHeaders(), params: { limit: 1000 } })).data;
  }

  async createRegistration(body) {
    return idFromLocation(await http.post('/v2/registrations', body, { headers: fiwareHeaders() }));
  }

  async deleteRegistration(id) {
    return http.delete(`/v2/registrations/${enc(id)}`, { headers: fiwareHeaders() }).then(() => true).catch(ignore404(false));
  }

  // ---- Subscriptions (histórico no STH-Comet / notificações opcionais ao backend) ----
  async listSubscriptions() {
    return (await http.get('/v2/subscriptions', { headers: fiwareHeaders(), params: { limit: 1000 } })).data;
  }

  async createSubscription(body) {
    return idFromLocation(await http.post('/v2/subscriptions', body, { headers: fiwareHeaders() }));
  }

  async deleteSubscription(id) {
    return http.delete(`/v2/subscriptions/${enc(id)}`, { headers: fiwareHeaders() }).then(() => true).catch(ignore404(false));
  }
}

module.exports = new OrionClient();
