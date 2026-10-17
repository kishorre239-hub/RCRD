const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch {}
const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://harikishorereddy9908_db_user:GeonixaLoom@cluster0.lsj9dut.mongodb.net/loom?appName=Cluster0';

async function fix() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('loom');
  const res = await db.collection('system_settings').updateMany(
    { driveRootFolderId: { $exists: true } },
    { $set: { driveRootFolderId: '1XuI65NmTH9w_8FYM1LJZYLPCYvWg27N7', updatedAt: Date.now() } }
  );
  console.log('Updated system_settings:', res.modifiedCount);
  const docs = await db.collection('system_settings').find({}).toArray();
  console.log('Current settings:', docs.map(d => ({ key: d.key, driveRootFolderId: d.driveRootFolderId })));
  await client.close();
}
fix().catch(console.error);
