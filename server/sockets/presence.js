const db = require('../config/db');
const roomService = require('../services/room.service');
const logger = require('../utils/logger');

const onlineUsers = new Map();

function registerPresence(io, socket) {
  const userId = socket.user.id;

  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socket.id);

  if (onlineUsers.get(userId).size === 1) {
    markOnline(io, userId, true);
  }

  socket.on('presence:list', () => {
    socket.emit('presence:list', Array.from(onlineUsers.keys()));
  });

  socket.on('disconnect', async () => {
    const set = onlineUsers.get(userId);
    if (!set) return;
    set.delete(socket.id);

    if (set.size === 0) {
      onlineUsers.delete(userId);
      await markOnline(io, userId, false);
    }
  });
}

async function markOnline(io, userId, isOnline) {
  try {
    await db.query(
      `UPDATE users SET is_online=$2, last_active_at=NOW(), updated_at=NOW() WHERE id=$1`,
      [userId, isOnline]
    );

    const room = await roomService.getRoomForUser(userId);
    if (!room) return;

    io.to(`room:${room.id}`).emit('presence:update', {
      userId,
      isOnline,
      lastActiveAt: new Date().toISOString()
    });

    logger.debug(`presence: user=${userId} online=${isOnline}`);
  } catch (e) {
    logger.error('presence update failed:', e.message);
  }
}

function isUserOnline(userId) {
  return onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
}

function getOnlineUserIds() {
  return Array.from(onlineUsers.keys());
}

module.exports = { registerPresence, isUserOnline, getOnlineUserIds };
