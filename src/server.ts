import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './config/database';
import { ensureDatabaseExists } from './config/init-db';

const app = createApp();

const startServer = async () => {
  try {
    // Automatically ensure database exists if not yet created
    await ensureDatabaseExists();

    // Verify database connection via Prisma
    await prisma.$connect();
    console.log('✅ Connected to MySQL database via Prisma');

    const server = app.listen(env.PORT, () => {
      console.log(`🚀 User Service running on http://localhost:${env.PORT}`);
      console.log(`📚 Swagger documentation available at http://localhost:${env.PORT}/api-docs`);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${env.PORT} is already in use. Run 'npm run dev' again (predev script will automatically free it).`);
      } else {
        console.error('❌ Server error:', err);
      }
      process.exit(1);
    });

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        console.log('Database disconnected. Process exited.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('❌ Failed to start User Service:', error);
    process.exit(1);
  }
};

startServer();
