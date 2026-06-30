import { env } from './src/config/env.js';
import app from './src/app.js';
import { connectDB } from './src/config/db.js';
import { logger } from './src/utils/logger.js';

const start = async () => {
  await connectDB();

  const server = app.listen(env.PORT, () => {
    logger.info(`StoreIt API running on port ${env.PORT} (${env.NODE_ENV})`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received. Shutting down gracefully.`);
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000); // Force exit after 10s
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
};

start();
