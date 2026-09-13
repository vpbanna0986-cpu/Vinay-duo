module.exports = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      details: parsed.error.flatten()
    });
  }
  req.body = parsed.data;
  next();
};
