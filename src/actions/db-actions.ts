'use server';

import { createClient } from '@libsql/client';
import { MongoClient } from 'mongodb';

export type DBConfig = {
  dbType: 'firebase' | 'mongodb' | 'turso';
  dbConnectionString?: string;
  dbAuthToken?: string;
};

/**
 * Intenta inicializar la base de datos externa creando las tablas o colecciones necesarias.
 * Esto asegura compatibilidad 100% al cambiar de motor.
 */
export async function initializeExternalDatabase(config: DBConfig) {
  const { dbType, dbConnectionString, dbAuthToken } = config;

  try {
    if (dbType === 'turso') {
      if (!dbConnectionString) throw new Error('Falta URL de conexión para Turso.');
      const client = createClient({
        url: dbConnectionString,
        authToken: dbAuthToken,
      });

      const schema = `
        CREATE TABLE IF NOT EXISTS publishers (
          id TEXT PRIMARY KEY,
          firstName TEXT,
          lastName TEXT,
          email TEXT,
          phone TEXT,
          subId TEXT,
          status TEXT DEFAULT 'active',
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS offers (
          id TEXT PRIMARY KEY,
          name TEXT,
          paymentAmount REAL,
          status TEXT DEFAULT 'active',
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS leads (
          id TEXT PRIMARY KEY,
          publisherId TEXT,
          offerId TEXT,
          date TEXT,
          quantity INTEGER,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS payments (
          id TEXT PRIMARY KEY,
          publisherId TEXT,
          amountUSD REAL,
          status TEXT DEFAULT 'pending',
          paymentPeriod TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS settings (
          id TEXT PRIMARY KEY,
          data TEXT,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `;

      // Ejecutamos el esquema (dividido por puntos y coma)
      const commands = schema.split(';').filter(cmd => cmd.trim() !== '');
      for (const cmd of commands) {
        await client.execute(cmd);
      }
      
      return { success: true, message: 'Base de Datos Turso inicializada con éxito.' };
    }

    if (dbType === 'mongodb') {
      if (!dbConnectionString) throw new Error('Falta Connection String para MongoDB.');
      const client = new MongoClient(dbConnectionString);
      await client.connect();
      const db = client.db('sirens_portal');

      // En MongoDB las colecciones se crean al insertar, pero podemos asegurar índices
      await db.collection('publishers').createIndex({ email: 1 }, { unique: true });
      await db.collection('leads').createIndex({ date: 1, publisherId: 1 });
      
      await client.close();
      return { success: true, message: 'Colecciones de MongoDB preparadas correctamente.' };
    }

    if (dbType === 'firebase') {
      return { success: true, message: 'Utilizando motor nativo de Firestore. No requiere inicialización DDL.' };
    }

    return { success: false, message: 'Tipo de base de datos no soportado para auto-init.' };
  } catch (error: any) {
    console.error('Database Init Error:', error);
    return { success: false, message: `Error al inicializar: ${error.message}` };
  }
}
