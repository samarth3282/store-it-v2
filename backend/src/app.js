import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import indexRouter from './routes/index.js';

const app = express();

// Security headers
app.use(helmet());

// CORS — only allow configured frontend + agent origins
app.use(cors({
  origin: [env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:8000'],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-agent-secret'],
}));

// Body & Cookie parsers
app.use(express.json({ limit: '50mb' }));           // JSON body (increased for vector embeddings)
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// HTTP access logging
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Routes
app.use('/api', indexRouter);

// Health check — for load balancers / CI
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler — must be last middleware
app.use(errorHandler);

export default app;
