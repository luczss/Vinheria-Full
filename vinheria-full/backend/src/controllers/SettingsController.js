const service = require('../services/SettingsService');
const asyncHandler = require('../utils/asyncHandler');

exports.get = asyncHandler(async (req, res) => res.json(await service.get(req.params.id)));
exports.patch = asyncHandler(async (req, res) => res.json(await service.patch(req.params.id, req.body)));
