const { z } = require('zod');

const username = z.string()
  .min(3).max(32)
  .regex(/^[a-zA-Z0-9_.]+$/, 'Only letters, numbers, _ and .');

const password = z.string().min(8).max(128);
const displayName = z.string().min(1).max(64);

module.exports = {
  registerSchema: z.object({ username, displayName, password }),
  loginSchema: z.object({ username, password }),
  createRoomSchema: z.object({}),
  joinRoomSchema: z.object({
    code: z.string().regex(/^\d{6}$/, '6-digit code required')
  })
};
