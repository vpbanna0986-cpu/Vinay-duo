/* ═══════════════════════════════════════════════════════
   VINAY DUO — Socket.IO Server Setup
   Made by VP
   ═══════════════════════════════════════════════════════ */

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
    // ✅ POLLING FIRST — Render free tier pe stable rehta hai
    transports: ['polling', 'websocket'],
    allowUpgrades: true,
    upgradeTimeout: 30000,

    // ✅ Long timeouts — background tabs aur slow networks ke liye
    pingInterval: 25000,
    pingTimeout: 60000,

    // ✅ Higher limits for stability
    maxHttpBufferSize: 1e6,
    connectTimeout: 45000,
    allowEIO3: true,

    // ✅ Cleanup on close
    cleanupEmptyChildNamespaces: true
  });

  io.use(socketAuth);

  io.on('connection', (socket) => {
    logger.info(`socket connected: user=${socket.user.username} id=${socket.id} transport=${socket.conn.transport.name}`);

    // Log transport upgrades
    socket.conn.on('upgrade', () => {
      logger.info(`socket upgraded: user=${socket.user.username} id=${socket.id} → ${socket.conn.transport.name}`);
    });

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

    socket.on('error', (err) => {
      logger.error(`socket error: user=${socket.user.username} err=${err.message}`);
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
