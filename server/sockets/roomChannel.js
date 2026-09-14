const roomService = require('../services/room.service');
const logger = require('../utils/logger');

function registerRoomChannel(io, socket) {
  const userId = socket.user.id;

  socket.on('room:join', async (payload, ack) => {
    try {
      const room = await roomService.getRoomForUser(userId);
      if (!room) {
        if (typeof ack === 'function') ack({ ok: false, error: 'NO_ROOM' });
        return;
      }

      const roomChannel = `room:${room.id}`;
      socket.join(roomChannel);
      socket.currentRoomId = room.id;

      const full = await roomService.attachMembers(room);

      socket.emit('room:state', full);

      socket.to(roomChannel).emit('room:member-joined', {
        userId,
        username: socket.user.username,
        displayName: socket.user.display_name,
        joinedAt: new Date().toISOString()
      });

      io.to(roomChannel).emit('room:sync', full);

      if (typeof ack === 'function') ack({ ok: true, room: full });
      logger.debug(`room:join user=${socket.user.username} room=${room.code}`);
    } catch (e) {
      logger.error('room:join failed:', e.message);
      if (typeof ack === 'function') ack({ ok: false, error: 'JOIN_FAILED' });
    }
  });

  socket.on('room:leave', async (payload, ack) => {
    try {
      if (socket.currentRoomId) {
        const roomChannel = `room:${socket.currentRoomId}`;
        socket.to(roomChannel).emit('room:member-left', {
          userId,
          leftAt: new Date().toISOString()
        });
        socket.leave(roomChannel);
        socket.currentRoomId = null;
      }
      if (typeof ack === 'function') ack({ ok: true });
    } catch (e) {
      if (typeof ack === 'function') ack({ ok: false, error: 'LEAVE_FAILED' });
    }
  });

  socket.on('room:resync', async (payload, ack) => {
    try {
      if (!socket.currentRoomId) {
        const room = await roomService.getRoomForUser(userId);
        if (!room) {
          if (typeof ack === 'function') ack({ ok: false, error: 'NO_ROOM' });
          return;
        }
        socket.join(`room:${room.id}`);
        socket.currentRoomId = room.id;
      }
      const room = await roomService.getRoomById(socket.currentRoomId);
      const full = await roomService.attachMembers(room);
      socket.emit('room:state', full);
      if (typeof ack === 'function') ack({ ok: true, room: full });
    } catch (e) {
      if (typeof ack === 'function') ack({ ok: false, error: 'RESYNC_FAILED' });
    }
  });

  socket.on('room:activity', (payload, ack) => {
    try {
      if (!socket.currentRoomId) return;
      const activity = typeof payload?.activity === 'string' ? payload.activity.slice(0, 60) : null;
      socket.to(`room:${socket.currentRoomId}`).emit('room:activity', {
        userId,
        activity,
        at: new Date().toISOString()
      });
      if (typeof ack === 'function') ack({ ok: true });
    } catch (e) {
      if (typeof ack === 'function') ack({ ok: false });
    }
  });
}

module.exports = { registerRoomChannel };
