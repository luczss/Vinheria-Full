// Validações puras (sem I/O) usadas por cadastro e configurações.
const { badRequest } = require('../utils/errors');

// latitude/longitude: ambos null (sem posição) ou ambos números válidos.
function validateCoordinates(latitude, longitude) {
  const lat = latitude ?? null;
  const lng = longitude ?? null;
  if (lat === null && lng === null) return { latitude: null, longitude: null };
  const ok = typeof lat === 'number' && typeof lng === 'number'
    && Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  if (!ok) throw badRequest('INVALID_COORDINATES', 'latitude (-90 a 90) e longitude (-180 a 180) devem ser números e informadas juntas');
  return { latitude: lat, longitude: lng };
}

// PATCH de configurações: se latitude OU longitude vier no corpo, as DUAS precisam vir.
// Devolve o par validado, ou null se nenhuma das duas foi enviada.
function validateCoordinatesPatch(body) {
  const hasLat = body.latitude !== undefined;
  const hasLng = body.longitude !== undefined;
  if (!hasLat && !hasLng) return null;
  if (hasLat !== hasLng) {
    throw badRequest('INVALID_COORDINATES', 'latitude (-90 a 90) e longitude (-180 a 180) devem ser números e informadas juntas');
  }
  return validateCoordinates(body.latitude, body.longitude);
}

// Próximo deviceId livre no padrão vinheriaNNN (vinheria001, vinheria002, ...).
function nextDeviceId(existingIds, prefix = 'vinheria') {
  let max = 0;
  const re = new RegExp(`^${prefix}(\\d+)$`);
  for (const id of existingIds) {
    const m = re.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

module.exports = { validateCoordinates, validateCoordinatesPatch, nextDeviceId };
