// Encapsula a API de provisionamento do IoT Agent (Ultralight / MQTT).
const config = require('../config');
const { createHttp, fiwareHeaders } = require('./http');

const http = createHttp('IOT_AGENT', config.iotAgent.url);
const enc = encodeURIComponent;

class IoTAgentClient {
  async about() {
    return (await http.get('/iot/about')).data;
  }

  // POST /iot/services. 409 = grupo já existe (ok, é compartilhado por todos os dispositivos).
  async createServiceGroup(group) {
    try {
      await http.post('/iot/services', { services: [group] }, { headers: fiwareHeaders() });
      return { created: true };
    } catch (e) {
      if (e.upstreamStatus === 409) return { created: false, alreadyExists: true };
      throw e;
    }
  }

  async getDevice(deviceId) {
    return http
      .get(`/iot/devices/${enc(deviceId)}`, { headers: fiwareHeaders() })
      .then((r) => r.data)
      .catch((e) => {
        if (e.upstreamStatus === 404) return null;
        throw e;
      });
  }

  // POST /iot/devices. 409 = dispositivo já provisionado.
  async createDevice(device) {
    try {
      await http.post('/iot/devices', { devices: [device] }, { headers: fiwareHeaders() });
      return { created: true };
    } catch (e) {
      if (e.upstreamStatus === 409) return { created: false, alreadyExists: true };
      throw e;
    }
  }

  async deleteDevice(deviceId) {
    return http
      .delete(`/iot/devices/${enc(deviceId)}`, { headers: fiwareHeaders() })
      .then(() => true)
      .catch((e) => {
        if (e.upstreamStatus === 404) return false;
        throw e;
      });
  }
}

module.exports = new IoTAgentClient();
