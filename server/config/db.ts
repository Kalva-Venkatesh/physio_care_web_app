import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let memoryServer: MongoMemoryServer | null = null;
let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  const envUri = process.env.MONGODB_URI?.trim();
  const hasRealAtlasUri =
    Boolean(envUri) &&
    !envUri!.includes('<username>') &&
    !envUri!.includes('<password>');

  let uri = envUri;

  if (!hasRealAtlasUri) {
    if (!memoryServer) {
      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbName: 'physiocare',
        },
      });
    }
    uri = memoryServer.getUri();
    console.log('[DB] MONGODB_URI not configured; running built-in MongoDB engine for preview.');
  } else {
    console.log('[DB] Connecting to MongoDB Atlas...');
  }

  await mongoose.connect(uri!, {
    autoIndex: true,
  });

  isConnected = true;
  console.log(`[DB] Connected to MongoDB (${mongoose.connection.name})`);
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
  isConnected = false;
}
