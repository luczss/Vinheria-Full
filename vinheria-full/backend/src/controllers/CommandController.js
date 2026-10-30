const service = require('../services/CommandService');
const asyncHandler = require('../utils/asyncHandler');

exports.send = asyncHandler(async (req, res) => res.status(202).json(await service.send(req.params.id, req.body)));
