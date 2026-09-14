require('./games');

const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const env = require('./config/env');
const logger = require('./utils/logger');
const routes = require('./routes');
const { globalLimiter } = require('./middleware/rateLimit');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));
app.use(compression());

const allowedOrigins = env.CLIENT_ORIGIN === '*'
  ? true
  : env.CLIENT_ORIGIN.split(',').map(s => s.trim());

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(globalLimiter);

app.use(express.static(path.join(__dirname, '..', 'client')));

app.use('/api', routes);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
  const indexPath = path.join(__dirname, '..', 'client', 'index.html');
  res.sendFile(indexPath, (err) => err ? next() : undefined);
});

app.use(notFoundHandler);
app.use(errorHandler);

const { initSockets } = require('./sockets');
initSockets(server);

try {
  require('./jobs/cleanup').start();
} catch (e) {
  logger.warn('cleanup job not started:', e.message);
}

const PORT = env.PORT;
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`VINAY DUO (${env.BRAND.author}) listening on :${PORT}`);
  logger.info(`Env: ${env.NODE_ENV}`);
});

process.on('unhandledRejection', (e) => logger.error('unhandledRejection', e));
process.on('uncaughtException',  (e) => logger.error('uncaughtException', e));

module.exports = { app, server };
