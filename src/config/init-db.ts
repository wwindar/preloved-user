import mysql from 'mysql2/promise';
import { env } from './env';

export const ensureDatabaseExists = async (): Promise<void> => {
  try {
    const dbUrl = new URL(env.DATABASE_URL);
    const dbName = dbUrl.pathname.replace(/^\//, '');

    if (!dbName) {
      return;
    }

    // Connect to MySQL server without selecting specific database
    const connection = await mysql.createConnection({
      host: dbUrl.hostname || 'localhost',
      port: dbUrl.port ? parseInt(dbUrl.port, 10) : 3306,
      user: dbUrl.username || 'root',
      password: dbUrl.password || '',
    });

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );

    await connection.end();
  } catch (error) {
    console.warn('⚠️ Auto-create database warning (continuing to connect via Prisma):', error);
  }
};
