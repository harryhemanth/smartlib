import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initializeDatabase } from './server/db.ts';
import { attachAuthContext, verifyCsrf } from './server/security.ts';
import { authRouter } from './server/routes/authRoutes.ts';
import { libraryRouter } from './server/routes/libraryRoutes.ts';
import { chatRouter } from './server/routes/chatRoutes.ts';
import { adminRouter } from './server/routes/adminRoutes.ts';

async function startServer() {
  initializeDatabase();

  const app = express();
  app.set('trust proxy', 1);
  const PORT = 3000;

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(attachAuthContext);
  app.use('/api', verifyCsrf);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'SmartLib AI', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/library', libraryRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/admin', adminRouter);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SmartLib AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SmartLib AI server:', err);
  process.exit(1);
});
