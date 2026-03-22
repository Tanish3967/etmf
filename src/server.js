/**
 * eTMF Pro — Backend API Server
 * Regulatory compliance: ICH E6(R2) | 21 CFR Part 11 | EU Annex 11 | GDPR | ALCOA+
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

import { initDB } from './database.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';

// Routes
import authRoutes      from './routes/auth.js';
import documentRoutes  from './routes/documents.js';
import workflowRoutes  from './routes/workflow.js';
import queryRoutes     from './routes/queries.js';
import auditRoutes     from './routes/audit.js';
import userRoutes      from './routes/users.js';
import studyRoutes     from './routes/studies.js';
import edlRoutes       from './routes/edl.js';
import reportRoutes    from './routes/reports.js';
import aiRoutes        from './routes/ai.js';
import notifRoutes     from './routes/notifications.js';
import adminRoutes     from './routes/admin.js';
import folderRoutes    from './routes/folders.js';
import { formRoutes, qcRoutes }  from './routes/all-routes.js';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// ── Security middleware ────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

// ── CORS (tenant-aware) ────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    const allowed = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173,http://localhost:5174').split(',');
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(new Error('CORS policy violation'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Tenant-ID','X-Request-ID'],
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));
app.use(requestLogger);

// ── Rate limiting (21 CFR Part 11 — account lockout protection) ──
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Account temporarily locked.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { error: 'API rate limit exceeded.' },
});

app.use('/api/auth/login', authLimiter);
app.use('/api/', apiLimiter);

// ── Health ─────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status: 'ok',
  version: '1.0.0',
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
  compliance: ['ICH E6(R2)', '21 CFR Part 11', 'EU Annex 11', 'GDPR', 'ALCOA+'],
}));

// ── API routes ─────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/documents',     documentRoutes);
app.use('/api/workflow',      workflowRoutes);
app.use('/api/queries',       queryRoutes);
app.use('/api/audit',         auditRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/studies',       studyRoutes);
app.use('/api/edl',           edlRoutes);
app.use('/api/reports',       reportRoutes);
app.use('/api/ai',            aiRoutes);
app.use('/api/notifications', notifRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/folders',       folderRoutes);
app.use('/api/forms',         formRoutes);
app.use('/api/qc',            qcRoutes);

// ── 404 ────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Endpoint not found', path: req.path }));

// ── Error handler ──────────────────────────────────────────
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────
async function start() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`\n✅ eTMF Pro API running on port ${PORT}`);
    console.log(`📋 Compliance: ICH E6(R2) | 21 CFR Part 11 | EU Annex 11`);
    console.log(`🔒 Security: JWT | MFA | RBAC | TLS | Audit trail\n`);
  });
}

start().catch(err => { console.error('Startup error:', err); process.exit(1); });

export default app;
