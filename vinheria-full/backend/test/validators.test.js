const test = require('node:test');
const assert = require('node:assert');
const { validateCoordinates, validateCoordinatesPatch, nextDeviceId } = require('../src/services/validators');

test('coordenadas: aceita par válido ou ambos nulos', () => {
  assert.deepStrictEqual(validateCoordinates(-23.55, -46.63), { latitude: -23.55, longitude: -46.63 });
  assert.deepStrictEqual(validateCoordinates(null, null), { latitude: null, longitude: null });
  assert.deepStrictEqual(validateCoordinates(undefined, undefined), { latitude: null, longitude: null });
});

test('coordenadas: rejeita fora da faixa, não numérico ou só uma delas', () => {
  assert.throws(() => validateCoordinates(91, 0), /latitude/);
  assert.throws(() => validateCoordinates(0, 181), /longitude/);
  assert.throws(() => validateCoordinates('10', '20'), /latitude/);
  assert.throws(() => validateCoordinates(10, null), /latitude/);
});

test('nextDeviceId: próximo livre no padrão vinheriaNNN', () => {
  assert.strictEqual(nextDeviceId([]), 'vinheria001');
  assert.strictEqual(nextDeviceId(['vinheria001', 'vinheria002', 'vinheria010']), 'vinheria011');
  assert.strictEqual(nextDeviceId(['outro', 'vinheria003']), 'vinheria004');
});

test('PATCH: latitude sem longitude (ou o contrário) é rejeitado; par completo ou nenhum é aceito', () => {
  assert.throws(() => validateCoordinatesPatch({ latitude: 10 }), /juntas/);
  assert.throws(() => validateCoordinatesPatch({ longitude: 10 }), /juntas/);
  assert.throws(() => validateCoordinatesPatch({ latitude: 95, longitude: 0 }), /latitude/);
  assert.deepStrictEqual(validateCoordinatesPatch({ latitude: 10, longitude: 20 }), { latitude: 10, longitude: 20 });
  assert.deepStrictEqual(validateCoordinatesPatch({ latitude: null, longitude: null }), { latitude: null, longitude: null });
  assert.strictEqual(validateCoordinatesPatch({ displayName: 'x' }), null);
});
