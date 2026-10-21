import { MongoClient, Db, Collection, Document } from 'mongodb';
import dns from 'dns';

// Enable public DNS servers to guarantee SRV record resolution across all local and cloud networks
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch {
  // Ignore in environments where setServers is restricted
}

const DEFAULT_SRV_URI = 'mongodb+srv://harikishorereddy9908_db_user:GeonixaLoom@cluster0.lsj9dut.mongodb.net/loom?appName=Cluster0';
const DEFAULT_DIRECT_URI = 'mongodb://harikishorereddy9908_db_user:GeonixaLoom@ac-qdl9dar-shard-00-00.lsj9dut.mongodb.net:27017,ac-qdl9dar-shard-00-01.lsj9dut.mongodb.net:27017,ac-qdl9dar-shard-00-02.lsj9dut.mongodb.net:27017/loom?ssl=true&replicaSet=atlas-b0p3vc-shard-0&authSource=admin&appName=Cluster0';

const uri = process.env.MONGODB_URI || DEFAULT_DIRECT_URI || DEFAULT_SRV_URI;

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

const clientOptions = {
  maxPoolSize: 10,
  minPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
  maxIdleTimeMS: 30000,
};

let indexesEnsured = false;
async function ensureEssentialIndexes(db: Db) {
  if (indexesEnsured) return;
  indexesEnsured = true;
  try {
    await Promise.all([
      db.collection('meetings').createIndex({ id: 1 }, { unique: true, sparse: true, background: true }),
      db.collection('meetings').createIndex({ status: 1, scheduledAt: -1 }, { background: true }),
      db.collection('videos').createIndex({ id: 1 }, { unique: true, sparse: true, background: true }),
      db.collection('videos').createIndex({ courseId: 1, createdAt: -1 }, { background: true }),
    ]);
  } catch (err) {
    console.warn('Index creation notice (harmless if already exists):', (err as Error)?.message);
  }
}

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, clientOptions);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In serverless production, cache client across warm container invocations
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, clientOptions);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
}

export async function getMongoClient(): Promise<MongoClient> {
  try {
    return await clientPromise;
  } catch (err) {
    console.warn('Retrying MongoDB connection due to prior failure:', (err as Error)?.message);
    client = new MongoClient(uri, clientOptions);
    clientPromise = client.connect();
    global._mongoClientPromise = clientPromise;
    return await clientPromise;
  }
}

export async function getDb(dbName: string = 'loom'): Promise<Db> {
  const clientInstance = await getMongoClient();
  const db = clientInstance.db(dbName);
  ensureEssentialIndexes(db).catch(() => {});
  return db;
}

export async function getCollection<T extends Document = Document>(
  collectionName: string,
  dbName: string = 'loom'
): Promise<Collection<T>> {
  const db = await getDb(dbName);
  return db.collection<T>(collectionName);
}

export default clientPromise;
