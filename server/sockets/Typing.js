const logger = require('../utils/logger');

const lastEmit = new Map();

function registerTyping(io, socket) {
  const userId = socket.user.id;

  socket.on('typing:start', () => {
    const now = Date.now();
    const last = lastEmit.get(userId) || 0;
    if (now - last < 2500) return;
    lastEmit.set(userId, now);

    if (!socket.currentRoomId) return;
    socket.to(`room:${socket.currentRoomId}`).emit('typing:start', {
      userId,
      username: socket.user.username,
      at: now
    });
  });

  socket.on('typing:stop', () => {
    lastEmit.delete(userId);
    if (!socket.currentRoomId) return;
    socket.to(`room:${socket.currentRoomId}`).emit('typing:stop', {
      userId,
      at: Date.now()
    });
  });

  socket.on('disconnect', () => {
    lastEmit.delete(userId);
    if (socket.currentRoomId) {
      socket.to(`room:${socket.currentRoomId}`).emit('typing:stop', {
        userId,
        at: Date.now()
      });
    }
  });
}

module.exports = { registerTyping };
