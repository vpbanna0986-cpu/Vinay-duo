const crypto = require('crypto');
function generateRoomCode() { return String(crypto.randomInt(100000, 999999)); }
function uuid() { return crypto.randomUUID(); }
module.exports = { generateRoomCode, uuid };
