export function requestLogger(req, res, next) {
  req.startTime = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - req.startTime;
    if (ms > 1000) console.warn(`[SLOW] ${req.method} ${req.path} — ${ms}ms`);
  });
  next();
}
