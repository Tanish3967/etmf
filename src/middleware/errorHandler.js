import { appendAudit } from '../database.js';

export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Log 500s
  if (status >= 500) {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.stack);
  }

  // Audit security errors
  if (status === 401 || status === 403) {
    try {
      appendAudit({
        tenantId: req.tenantId || 'unknown',
        userId: req.user?.id,
        userName: req.user?.name || req.ip,
        action: status === 401 ? 'Auth Failure' : 'Access Denied',
        objectType: 'endpoint',
        objectName: `${req.method} ${req.path}`,
        detail: message,
        ip: req.ip,
      });
    } catch (_) {}
  }

  res.status(status).json({
    error: message,
    code: err.code || 'ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

export function requestLogger(req, res, next) {
  req.startTime = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - req.startTime;
    if (ms > 1000) console.warn(`[SLOW] ${req.method} ${req.path} — ${ms}ms`);
  });
  next();
}

export function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        fields: error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
      });
    }
    req.body = value;
    next();
  };
}
