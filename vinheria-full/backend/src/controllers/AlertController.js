const alertEngine = require('../services/AlertEngine');
const asyncHandler = require('../utils/asyncHandler');
const { badRequest } = require('../utils/errors');

exports.list = asyncHandler(async (req, res) => {
  let limit = 20;
  if (req.query.limit !== undefined) {
    limit = Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw badRequest('INVALID_QUERY', 'limit deve ser inteiro entre 1 e 200');
  }
  res.json(await alertEngine.getAlerts(req.params.id, { limit }));
});
