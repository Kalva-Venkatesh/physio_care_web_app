import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './server/config/db';
import { seedDatabaseIfEmpty } from './server/seed';
import authRoutes from './server/routes/auth';
import publicRoutes from './server/routes/public';
import appointmentRoutes from './server/routes/appointments';
import notificationRoutes from './server/routes/notifications';
import physioRoutes from './server/routes/physio';
import adminRoutes from './server/routes/admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  await connectDB();
  await seedDatabaseIfEmpty();

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Origin not allowed by CORS policy'));
        }
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timezone: 'Asia/Kolkata', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api', publicRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/physio', physioRoutes);
  app.use('/api/admin', adminRoutes);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (process.env.SERVE_STATIC === 'true') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] PhysioCare running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server Fatal Error]', err);
  process.exit(1);
});
