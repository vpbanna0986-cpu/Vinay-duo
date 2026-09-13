const { Server } = require('socket.io');
const env = require('../config/env');
const logger = require('../utils/logger');
const { socketAuth } = require('./auth');
const { registerPresence } = require('./presence');
const { registerRoomChannel } = require('./roomChannel');
const { registerTyping } = require('./typing');

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

  // Auth middleware — har socket connect hone se pehle token check
  io.use(socketAuth);

  io.on('connection', (socket) => {
    logger.info(`socket connected: user=${socket.user.username} id=${socket.id}`);

    // Har user apne personal room mein auto-join karta hai
    // (personal notifications ke liye)
    socket.join(`user:${socket.user.id}`);

    // Feature modules
    registerPresence(io, socket);
    registerRoomChannel(io, socket);
    registerTyping(io, socket);

    socket.on('disconnect', (reason) => {
      logger.info(`socket disconnected: user=${socket.user.username} reason=${reason}`);
    });
  });

  // Helper: kisi room ke saare members ko event bhejna
  io.toRoom = (roomId, event, payload) => {
    io.to(`room:${roomId}`).emit(event, payload);
  };

  // Helper: kisi user ko direct event bhejna
  io.toUser = (userId, event, payload) => {
    io.to(`user:${userId}`).emit(event, payload);
  };

  return io;
}

module.exports = { initSockets };
