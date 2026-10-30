const service = require('../services/MeasurementService');
const asyncHandler = require('../utils/asyncHandler');

exports.current = asyncHandler(async (req, res) => res.json(await service.current(req.params.id)));
exports.history = asyncHandler(async (req, res) => res.json(await service.history(req.params.id, req.query)));
