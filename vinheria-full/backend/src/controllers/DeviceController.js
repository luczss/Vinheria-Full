const deviceService = require('../services/DeviceService');
const asyncHandler = require('../utils/asyncHandler');

exports.list = asyncHandler(async (req, res) => {
  const devices = await deviceService.list();
  res.json({ devices, count: devices.length });
});
exports.create = asyncHandler(async (req, res) => res.status(201).json(await deviceService.create(req.body)));
exports.get = asyncHandler(async (req, res) => res.json(await deviceService.get(req.params.id)));
exports.remove = asyncHandler(async (req, res) => res.json(await deviceService.remove(req.params.id)));
