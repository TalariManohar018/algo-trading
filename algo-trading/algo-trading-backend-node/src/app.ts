import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { env } from './config/env';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';

const app = express();

// ── Security ─────────────────────────────────────────────
app.use(helmet());
app.use(cors({
    origin: env.CORS_ORIGIN.split(',').map(s => s.trim()),
    credentials: true,
}));

// ── Body parsing ─────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// ── Request logging ──────────────────────────────────────
app.use(morgan('short'));

// ── Rate limiting ────────────────────────────────────────
app.use('/api', apiLimiter);

// ── Health check ─────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status: 'healthy',
        version: '1.0.0',
        mode: env.TRADING_MODE,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// ── API Routes ───────────────────────────────────────────
app.use('/api', routes);

// ── 404 handler ──────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
});

// ── Global error handler ─────────────────────────────────
app.use(errorHandler);

export default app;
