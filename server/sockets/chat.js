const chatService = require('../services/chat.service');
const roomService = require('../services/room.service');
const logger = require('../utils/logger');

function registerChat(io, socket) {
  const userId = socket.user.id;

  // ───── Send message ─────
  socket.on('chat:send', async (payload, ack) => {
    try {
      if (!socket.currentRoomId) {
        return ack?.({ ok: false, error: 'NO_ROOM' });
      }
      const { content, replyToId, messageType, metadata } = payload || {};

      const msg = await chatService.createMessage({
        roomId: socket.currentRoomId,
        senderId: userId,
        content,
        replyToId,
        messageType,
        metadata
      });

      // Broadcast to everyone in room
      io.to(`room:${socket.currentRoomId}`).emit('chat:new', msg);

      ack?.({ ok: true, message: msg });
    } catch (e) {
      logger.error('chat:send failed:', e.message);
      ack?.({ ok: false, error: e.code || 'SEND_FAILED' });
    }
  });

  // ───── Edit own message ─────
  socket.on('chat:edit', async (payload, ack) => {
    try {
      const { messageId, content } = payload || {};
      const msg = await chatService.editMessage({
        messageId, userId, content
      });
      io.to(`room:${socket.currentRoomId}`).emit('chat:edited', msg);
      ack?.({ ok: true, message: msg });
    } catch (e) {
      ack?.({ ok: false, error: e.code || 'EDIT_FAILED' });
    }
  });

  // ───── Delete own message ─────
  socket.on('chat:delete', async (payload, ack) => {
    try {
      const { messageId } = payload || {};
      const result = await chatService.deleteMessage({ messageId, userId });
      io.to(`room:${socket.currentRoomId}`).emit('chat:deleted', result);
      ack?.({ ok: true });
    } catch (e) {
      ack?.({ ok: false, error: e.code || 'DELETE_FAILED' });
    }
  });

  // ───── Add / remove emoji reaction ─────
  socket.on('chat:react', async (payload, ack) => {
    try {
      const { messageId, emoji } = payload || {};
      const result = await chatService.toggleReaction({
        messageId, userId, emoji
      });
      io.to(`room:${socket.currentRoomId}`).emit('chat:reaction', result);
      ack?.({ ok: true, ...result });
    } catch (e) {
      ack?.({ ok: false, error: e.code || 'REACT_FAILED' });
    }
  });

  // ───── Mark messages as seen ─────
  socket.on('chat:seen', async (payload, ack) => {
    try {
      const { messageIds } = payload || {};
      const result = await chatService.markSeen({
        roomId: socket.currentRoomId, userId, messageIds
      });
      io.to(`room:${socket.currentRoomId}`).emit('chat:seen', result);
      ack?.({ ok: true, ...result });
    } catch (e) {
      ack?.({ ok: false, error: e.code || 'SEEN_FAILED' });
    }
  });

  // ───── Load recent messages (last 2h) ─────
  socket.on('chat:history', async (payload, ack) => {
    try {
      const limit = Math.min(payload?.limit || 100, 200);
      const messages = await chatService.getRecentMessages(socket.currentRoomId, limit);
      ack?.({ ok: true, messages });
    } catch (e) {
      ack?.({ ok: false, error: 'HISTORY_FAILED' });
    }
  });
}

module.exports = { registerChat };
