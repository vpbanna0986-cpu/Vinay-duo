const { Server } = require('socket.io');
const env = require('../config/env');
const logger = require('../utils/logger');

function initSockets(server) {
  const io = new Server(server, {
    cors: {
      origin: env.CLIENT_ORIGIN === '*' ? true : [env.CLIENT_ORIGIN],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });
  io.on('connection', (socket) => {
    logger.debug('socket connected', socket.id);
    socket.on('disconnect', () => logger.debug('socket disconnected', socket.id));
  });
  return io;
}

module.exports = { initSockets };
