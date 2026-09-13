const db = require('../config/db');
const { generateRoomCode } = require('../utils/ids');
const { badRequest, conflict, forbidden, notFound } = require('../utils/errors');

const MAX_MEMBERS = 2;

async function createRoom(userId) {
  const existing = await db.query(
    `SELECT r.* FROM rooms r
     JOIN room_members rm ON rm.room_id = r.id
     WHERE rm.user_id = $1 AND r.status IN ('open','full')
     LIMIT 1`,
    [userId]
  );
  if (existing.rowCount) return existing.rows[0];

  let code;
  for (let i = 0; i < 5; i++) {
    code = generateRoomCode();
    const clash = await db.query('SELECT 1 FROM rooms WHERE code=$1', [code]);
    if (!clash.rowCount) break;
    code = null;
  }
  if (!code) throw conflict('Could not allocate room code, try again');

  return await db.tx(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO rooms (code, owner_id, status) VALUES ($1, $2, 'open') RETURNING *`,
      [code, userId]
    );
    const room = rows[0];
    await client.query(
      `INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [room.id, userId]
    );
    return room;
  });
}

async function joinRoom(userId, code) {
  return await db.tx(async (client) => {
    const { rows } = await client.query('SELECT * FROM rooms WHERE code=$1 FOR UPDATE', [code]);
    const room = rows[0];
    if (!room) throw notFound('Room not found');
    if (room.status === 'closed') throw badRequest('Room is closed');

    const members = await client.query('SELECT user_id FROM room_members WHERE room_id=$1', [room.id]);
    const ids = members.rows.map(r => r.user_id);
    if (ids.includes(userId)) return room;
    if (ids.length >= MAX_MEMBERS) throw conflict('ROOM_FULL');

    await client.query(
      `INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, 'member')`,
      [room.id, userId]
    );
    await client.query(`UPDATE rooms SET status='full', last_activity_at=NOW() WHERE id=$1`, [room.id]);
    return { ...room, status: 'full' };
  });
}

async function getRoomForUser(userId) {
  const { rows } = await db.query(
    `SELECT r.* FROM rooms r
     JOIN room_members rm ON rm.room_id = r.id
     WHERE rm.user_id = $1 AND r.status IN ('open','full')
     ORDER BY r.created_at DESC LIMIT 1`,
    [userId]
  );
  if (!rows[0]) return null;
  return attachMembers(rows[0]);
}

async function attachMembers(room) {
  const { rows } = await db.query(
    `SELECT rm.user_id, rm.role, rm.joined_at,
            u.username, u.display_name, u.avatar_url, u.is_online, u.last_active_at, u.xp, u.level
       FROM room_members rm
       JOIN users u ON u.id = rm.user_id
      WHERE rm.room_id = $1`,
    [room.id]
  );
  return { ...room, members: rows };
}

async function getRoomById(roomId) {
  const { rows } = await db.query('SELECT * FROM rooms WHERE id=$1', [roomId]);
  return rows[0] || null;
}

async function assertMember(roomId, userId) {
  const { rowCount } = await db.query(
    'SELECT 1 FROM room_members WHERE room_id=$1 AND user_id=$2',
    [roomId, userId]
  );
  if (!rowCount) throw forbidden('Not a member of this room');
}

async function leaveRoom(userId) {
  return await db.tx(async (client) => {
    const { rows } = await client.query(
      `SELECT room_id FROM room_members WHERE user_id=$1 LIMIT 1`,
      [userId]
    );
    if (!rows[0]) return { ok: true };
    const roomId = rows[0].room_id;

    await client.query('DELETE FROM room_members WHERE user_id=$1 AND room_id=$2', [userId, roomId]);

    const remaining = await client.query(
      'SELECT COUNT(*)::int AS c FROM room_members WHERE room_id=$1',
      [roomId]
    );
    if (remaining.rows[0].c === 0) {
      await client.query(`UPDATE rooms SET status='closed', last_activity_at=NOW() WHERE id=$1`, [roomId]);
    } else {
      await client.query(`UPDATE room_members SET role='owner' WHERE room_id=$1 AND role='member'`, [roomId]);
      await client.query(
        `UPDATE rooms SET owner_id=(SELECT user_id FROM room_members WHERE room_id=$1 LIMIT 1),
                          status='open', last_activity_at=NOW()
         WHERE id=$1`,
        [roomId]
      );
    }
    return { ok: true, roomId };
  });
}

async function touchActivity(roomId) {
  await db.query('UPDATE rooms SET last_activity_at=NOW() WHERE id=$1', [roomId]);
}

module.exports = {
  createRoom, joinRoom, getRoomForUser, getRoomById,
  assertMember, leaveRoom, touchActivity, attachMembers, MAX_MEMBERS
};
