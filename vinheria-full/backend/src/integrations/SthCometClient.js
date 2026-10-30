// Encapsula consultas de histórico ao STH-Comet e devolve pontos simples {timestamp, value}.
const config = require('../config');
const { createHttp, fiwareHeaders } = require('./http');

const http = createHttp('STH_COMET', config.sth.url);
const enc = encodeURIComponent;

class SthCometClient {
  async version() {
    return (await http.get('/version')).data;
  }

  // Parâmetros suportados: lastN | (hLimit, hOffset, dateFrom, dateTo)
  async getAttributeHistory({ entityType, entityId, attribute, lastN, hLimit, hOffset, dateFrom, dateTo }) {
    const path = `/STH/v1/contextEntities/type/${enc(entityType)}/id/${enc(entityId)}/attributes/${enc(attribute)}`;
    let data;
    try {
      ({ data } = await http.get(path, { headers: fiwareHeaders(), params: { lastN, hLimit, hOffset, dateFrom, dateTo } }));
    } catch (e) {
      if (e.upstreamStatus === 404) return []; // sem dados ainda
      throw e;
    }
    const values = data?.contextResponses?.[0]?.contextElement?.attributes?.[0]?.values || [];
    return values
      .map((v) => ({ timestamp: v.recvTime, value: v.attrValue === '' || v.attrValue == null ? null : Number(v.attrValue) }))
      .filter((p) => p.value !== null && Number.isFinite(p.value))
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  }
}

module.exports = new SthCometClient();
