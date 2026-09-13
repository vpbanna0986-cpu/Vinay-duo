const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

function notFoundHandler(_req, res) {
  res.status(404).json({ ok: false, error: 'NOT_FOUND' });
}

function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      ok: false, error: err.code, message: err.message, details: err.details
    });
  }
  if (err && err.code === '23505') {
    return res.status(409).json({ ok: false, error: 'CONFLICT', message: 'Already exists' });
  }
  if (err && err.code === '23503') {
    return res.status(400).json({ ok: false, error: 'FK_VIOLATION' });
  }
  if (err && err.message === 'ROOM_FULL') {
    return res.status(409).json({ ok: false, error: 'ROOM_FULL', message: 'Room already has 2 members' });
  }
  logger.error('unhandled', err);
  res.status(500).json({ ok: false, error: 'INTERNAL', message: 'Something went wrong' });
}

module.exports = { notFoundHandler, errorHandler };
