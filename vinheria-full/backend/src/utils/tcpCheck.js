// Verificação TCP simples (usada para o MQTT broker, sem depender de biblioteca MQTT).
const net = require('net');

module.exports = function tcpCheck(host, port, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    const fail = (err) => { socket.destroy(); reject(err); };
    socket.setTimeout(timeoutMs, () => fail(Object.assign(new Error(`timeout conectando a ${host}:${port}`), { code: 'ETIMEDOUT' })));
    socket.once('error', fail);
    socket.once('connect', () => { socket.end(); resolve({ host, port }); });
  });
};
