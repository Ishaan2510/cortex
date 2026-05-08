require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');

const app = express();

app.use(helmet());
const allowedOrigins = new Set(
  [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URLS,
  ]
    .filter(Boolean)
    .flatMap((value) => value.split(','))
    .map((origin) => origin.trim())
    .filter(Boolean)
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
  })
);
app.use(express.json());
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.use('/api/auth', authRoutes);
app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.use((_, res) => res.status(404).json({ message: 'Route not found' }));

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
});