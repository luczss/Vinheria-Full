const express = require('express');
const cors = require('cors');
const config = require('./config');
const createLogger = require('./config/logger');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

const log = createLogger('API');
const app = express();

app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((s) => s.trim()) }));
app.use(express.json({ limit: '256kb' }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => log.debug(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`));
  next();
});

app.use('/api/v1', routes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
