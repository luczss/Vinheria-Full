const service = require('../services/TriggerService');
const asyncHandler = require('../utils/asyncHandler');

exports.get = asyncHandler(async (req, res) => res.json(await service.get(req.params.id)));
exports.put = asyncHandler(async (req, res) => res.json(await service.put(req.params.id, req.body)));
