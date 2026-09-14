const db = require('../config/db');
const roomService = require('./room.service');
const { badRequest, forbidden, notFound } = require('../utils/errors');

const MAX_MESSAGE_LENGTH = 2000;

async function createMessage({ roomId, senderId, content, replyToId, messageType, metadata }) {
  await roomService.assertMember(roomId, senderId);

  const type = messageType || 'text';
  if (type === 'text') {
    if (typeof content !== 'string' || !content.trim()) throw badRequest('Empty message');
    if (content.length > MAX_MESSAGE_LENGTH) throw badRequest('Message too long');
  }

  if (replyToId) {
    const { rowCount } = await db.query(
      'SELECT 1 FROM messages WHERE id=$1 AND room_id=$2 AND deleted_at IS NULL',
      [replyToId, roomId]
    );
    if (!rowCount) throw badRequest('Reply target not found');
  }

  const { rows } = await db.query(
    `INSERT INTO messages (room_id, sender_id, content, message_type, reply_to_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, room_id, sender_id, content, message_type, reply_to_id, metadata,
               edited_at, deleted_at, seen_at, created_at, expires_at`,
    [roomId, senderId, content || null, type, replyToId || null, metadata || {}]
  );

  await roomService.touchActivity(roomId);
  return rows[0];
}

async function editMessage({ messageId, userId, content }) {
  if (!content || !content.trim()) throw badRequest('Empty message');
  if (content.length > MAX_MESSAGE_LENGTH) throw badRequest('Message too long');

  const { rows } = await db.query(
    `SELECT id, sender_id, deleted_at, expires_at FROM messages WHERE id=$1`,
    [messageId]
  );
  const msg = rows[0];
  if (!msg) throw notFound('Message not found');
  if (msg.sender_id !== userId) throw forbidden('Not your message');
  if (msg.deleted_at) throw badRequest('Message deleted');
  if (new Date(msg.expires_at) < new Date()) throw badRequest('Message expired');

  const { rows: out } = await db.query(
    `UPDATE messages SET content=$2, edited_at=NOW()
      WHERE id=$1
      RETURNING id, room_id, sender_id, content, message_type, reply_to_id, metadata,
                edited_at, deleted_at, seen_at, created_at, expires_at`,
    [messageId, content.trim()]
  );
  return out[0];
}

async function deleteMessage({ messageId, userId }) {
  const { rows } = await db.query(
    `SELECT id, room_id, sender_id, deleted_at FROM messages WHERE id=$1`,
    [messageId]
  );
  const msg = rows[0];
  if (!msg) throw notFound('Message not found');
  if (msg.sender_id !== userId) throw forbidden('Not your message');
  if (msg.deleted_at) return { messageId, roomId: msg.room_id, alreadyDeleted: true };

  await db.query(
    `UPDATE messages SET deleted_at=NOW(), content=NULL WHERE id=$1`,
    [messageId]
  );

  return { messageId, roomId: msg.room_id };
}

async function toggleReaction({ messageId, userId, emoji }) {
  if (!emoji || typeof emoji !== 'string' || emoji.length > 8) throw badRequest('Bad emoji');

  const { rows } = await db.query(
    `SELECT id, room_id FROM messages WHERE id=$1 AND deleted_at IS NULL`,
    [messageId]
  );
  const msg = rows[0];
  if (!msg) throw notFound('Message not found');

  // Try remove first (toggle behavior)
  const del = await db.query(
    `DELETE FROM message_reactions
      WHERE message_id=$1 AND user_id=$2 AND emoji=$3
      RETURNING id`,
    [messageId, userId, emoji]
  );

  let action = 'removed';
  if (del.rowCount === 0) {
    await db.query(
      `INSERT INTO message_reactions (message_id, user_id, emoji)
       VALUES ($1, $2, $3)
       ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
      [messageId, userId, emoji]
    );
    action = 'added';
  }

  // Get all reactions for this message
  const reactions = await db.query(
    `SELECT emoji, COUNT(*)::int AS count, ARRAY_AGG(user_id) AS users
       FROM message_reactions WHERE message_id=$1
       GROUP BY emoji`,
    [messageId]
  );

  return {
    messageId,
    roomId: msg.room_id,
    action,
    reactions: reactions.rows
  };
}

async function markSeen({ roomId, userId, messageIds }) {
  await roomService.assertMember(roomId, userId);

  const ids = Array.isArray(messageIds) && messageIds.length
    ? messageIds
    : null;

  const result = await db.query(
    `UPDATE messages
        SET seen_at = NOW()
      WHERE room_id = $1
        AND sender_id <> $2
        AND seen_at IS NULL
        AND deleted_at IS NULL
        AND ($3::uuid[] IS NULL OR id = ANY($3::uuid[]))
      RETURNING id`,
    [roomId, userId, ids]
  );

  return {
    roomId,
    by: userId,
    seenIds: result.rows.map(r => r.id)
  };
}

async function getRecentMessages(roomId, limit = 100) {
  const { rows } = await db.query(
    `SELECT m.id, m.room_id, m.sender_id, m.content, m.message_type, m.reply_to_id,
            m.metadata, m.edited_at, m.deleted_at, m.seen_at, m.created_at, m.expires_at,
            COALESCE(
              (SELECT json_agg(json_build_object('emoji', r.emoji, 'user_id', r.user_id))
                 FROM message_reactions r WHERE r.message_id = m.id),
              '[]'::json
            ) AS reactions
       FROM messages m
      WHERE m.room_id = $1
        AND m.expires_at > NOW()
      ORDER BY m.created_at DESC
      LIMIT $2`,
    [roomId, limit]
  );
  return rows.reverse();
}

module.exports = {
  createMessage, editMessage, deleteMessage,
  toggleReaction, markSeen, getRecentMessages,
  MAX_MESSAGE_LENGTH
};
