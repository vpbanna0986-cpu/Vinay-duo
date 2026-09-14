const { Server } = require('socket.io');
const env = require('../config/env');
const logger = require('../utils/logger');
const { socketAuth } = require('./auth');
const { registerPresence } = require('./presence');
const { registerRoomChannel } = require('./roomChannel');
const { registerTyping } = require('./typing');
const { registerChat } = require('./chat');
const { registerChallenge } = require('./challenge');
const { registerGame } = require('./game');

function initSockets(server) {
  const io = new Server(server, {
    cors: {
      origin: env.CLIENT_ORIGIN === '*' ? true : env.CLIENT_ORIGIN.split(',').map(s => s.trim()),
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 20000
  });

  io.use(socketAuth);

  io.on('connection', (socket) => {
    logger.info(`socket connected: user=${socket.user.username} id=${socket.id}`);

    socket.join(`user:${socket.user.id}`);

    registerPresence(io, socket);
    registerRoomChannel(io, socket);
    registerTyping(io, socket);
    registerChat(io, socket);
    registerChallenge(io, socket);
    registerGame(io, socket);

    socket.on('disconnect', (reason) => {
      logger.info(`socket disconnected: user=${socket.user.username} reason=${reason}`);
    });
  });

  io.toRoom = (roomId, event, payload) => {
    io.to(`room:${roomId}`).emit(event, payload);
  };

  io.toUser = (userId, event, payload) => {
    io.to(`user:${userId}`).emit(event, payload);
  };

  return io;
}

module.exports = { initSockets };
