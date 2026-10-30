const { Router } = require('express');
const health = require('../controllers/HealthController');
const devices = require('../controllers/DeviceController');
const measurements = require('../controllers/MeasurementController');
const triggers = require('../controllers/TriggerController');
const settings = require('../controllers/SettingsController');
const alerts = require('../controllers/AlertController');
const commands = require('../controllers/CommandController');
const notifications = require('../controllers/NotificationController');

const router = Router();

router.get('/health', health.basic);
router.get('/health/dependencies', health.dependencies);

router.get('/devices', devices.list);
router.post('/devices', devices.create);
router.get('/devices/:id', devices.get);
router.delete('/devices/:id', devices.remove);

router.get('/devices/:id/measurements/current', measurements.current);
router.get('/devices/:id/measurements/history', measurements.history);

router.get('/devices/:id/triggers', triggers.get);
router.put('/devices/:id/triggers', triggers.put);

router.get('/devices/:id/settings', settings.get);
router.patch('/devices/:id/settings', settings.patch);

router.get('/devices/:id/alerts', alerts.list);
router.post('/devices/:id/commands', commands.send);

// Uso interno: destino da subscription opcional do Orion
router.post('/internal/orion-notifications', notifications.orionNotification);

module.exports = router;
