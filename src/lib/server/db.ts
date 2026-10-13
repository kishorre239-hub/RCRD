import { MongoClient, Db, Collection } from 'mongodb';
import dns from 'dns';

// Enable public DNS servers to guarantee SRV record resolution across all local and cloud networks
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore in environments where setServers is restricted
}

const DEFAULT_URI = 'mongodb+srv://harikishorereddy9908_db_user:GeonixaLoom@cluster0.lsj9dut.mongodb.net/loom?appName=Cluster0';

const uri = process.env.MONGODB_URI || DEFAULT_URI;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

const clientOptions = {
  maxPoolSize: 20,
  minPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
};

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, clientOptions);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, clientOptions);
  clientPromise = client.connect();
}

export async function getMongoClient(): Promise<MongoClient> {
  try {
    return await clientPromise;
  } catch (err) {
    console.warn('Retrying MongoDB connection due to prior failure:', (err as any)?.message);
    client = new MongoClient(uri, clientOptions);
    clientPromise = client.connect();
    if (process.env.NODE_ENV === 'development') {
      global._mongoClientPromise = clientPromise;
    }
    return await clientPromise;
  }
}

export async function getDb(dbName: string = 'loom'): Promise<Db> {
  const clientInstance = await getMongoClient();
  return clientInstance.db(dbName);
}

export async function getCollection<T extends Record<string, any> = any>(
  collectionName: string,
  dbName: string = 'loom'
): Promise<Collection<T>> {
  const db = await getDb(dbName);
  return db.collection<T>(collectionName);
}

export default clientPromise;
