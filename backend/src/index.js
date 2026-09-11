const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const appEnv = process.env.APP_ENV || 'local';
const envFile =
  appEnv === 'docker'
    ? '.env.docker'
    : appEnv === 'local'
      ? '.env.local'
      : '.env';
const envPath = path.resolve(__dirname, '..', envFile);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const { sweepStuckTasks } = require('./services/taskProcessor');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');

const app = express();

app.set('trust proxy', 1); // behind Render's proxy: correct client IP for rate limiting
app.use(helmet());

const ALLOWED_ORIGINS = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
  .split(',')
  .map(s => s.trim().replace(/\/$/, ''))   // strip trailing slash
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow no-origin requests (curl, health checks, server-to-server)
    if (!origin) return callback(null, true);

    const normalized = origin.replace(/\/$/, '');

    if (ALLOWED_ORIGINS.includes(normalized)) {
      return callback(null, true);
    }

    // Allow Vercel preview deployments for this project
    if (/^https:\/\/cortex-ai-task-platform.*\.vercel\.app$/.test(normalized)) {
      return callback(null, true);
    }

    // Allow localhost during development
    if (/^http:\/\/localhost:\d+$/.test(normalized)) {
      return callback(null, true);
    }

    console.warn(`[CORS] rejected origin: ${origin}`);
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Set-Cookie'],
};

app.use(cors(corsOptions));
app.options('/{*path}', cors(corsOptions)); 
app.use(express.json());
app.use(cookieParser());
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.use((_, res) => res.status(404).json({ message: 'Route not found' }));

const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
  await sweepStuckTasks();
  app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
});