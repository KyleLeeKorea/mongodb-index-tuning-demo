require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const config = require('./config');

let client = null;
let currentUri = null;

async function connectToDatabase() {
  const uri = process.env.MONGODB_URI || config.MONGODB_URI;
  const dbName = process.env.DB_NAME || config.DB_NAME;

  try {
    // If the URI has changed, close old client and create new one
    if (currentUri !== uri) {
      if (client) {
        try {
          await client.close();
        } catch (err) {
          console.error('Error closing old client:', err);
        }
        client = null;
      }
      currentUri = uri;
    }

    // Create client if it doesn't exist or is not connected
    if (!client) {
      client = new MongoClient(uri);
      await client.connect();
    }
    
    const db = client.db(dbName);
    return { client, db };
  } catch (error) {
    console.error('Database connection error:', error);
    // Reset client on error
    if (client) {
      client = null;
    }
    currentUri = null;
    throw error;
  }
}

async function generateSampleData(count = 1000000) {
  const { db } = await connectToDatabase();
  
  // Determine collection name based on count
  const collectionName = count === 1000000 ? 'products_1m' : 'products_10m';
  
  const categories = ['Electronics', 'Clothing', 'Books', 'Food', 'Toys', 'Sports', 'Home', 'Automotive'];
  const suppliers = ['Supplier A', 'Supplier B', 'Supplier C', 'Supplier D', 'Supplier E'];
  
  console.log(`Generating ${count} sample documents in ${collectionName}...`);
  
  const batchSize = 10000;
  let insertedCount = 0;
  const batches = [];
  
  // Drop existing collection if it exists and create a new one
  try {
    await db.collection(collectionName).drop();
    console.log(`Dropped existing ${collectionName} collection`);
  } catch (error) {
    // Collection doesn't exist, which is fine
    console.log(`No existing ${collectionName} collection to drop`);
  }
  
  // Generate and insert data in batches
  for (let i = 0; i < count; i++) {
    const now = new Date();
    const product = {
      name: `Product ${i}`,
      sku: `SKU-${String(i).padStart(8, '0')}`,
      category: categories[i % categories.length],
      brand: `Brand ${Math.floor(i / 10000) % 100}`,
      supplier: suppliers[i % suppliers.length],
      price: Math.round((Math.random() * 1000 + 10) * 100) / 100,
      stock: Math.floor(Math.random() * 1000),
      rating: Math.round((Math.random() * 4 + 1) * 10) / 10,
      tags: [
        `tag${i % 50}`,
        `tag${(i + 1) % 50}`,
        `tag${(i + 2) % 50}`
      ],
      createdAt: new Date(now.getTime() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      views: Math.floor(Math.random() * 10000),
      status: ['active', 'inactive', 'pending'][i % 3]
    };
    
    batches.push(product);
    
    if (batches.length >= batchSize) {
      await db.collection(collectionName).insertMany(batches);
      insertedCount += batches.length;
      console.log(`Inserted ${insertedCount.toLocaleString()} / ${count.toLocaleString()} documents...`);
      batches.length = 0;
    }
  }
  
  // Insert remaining documents
  if (batches.length > 0) {
    await db.collection(collectionName).insertMany(batches);
    insertedCount += batches.length;
  }
  
  console.log(`Total documents inserted into ${collectionName}: ${insertedCount}`);
  
  const result = { insertedCount, collections: [collectionName], collectionName };
  return result;
}

async function getStatistics() {
  const { db } = await connectToDatabase();
  
  // Check both products_1m and products_10m collections
  const collections = {
    'products_1m': 0,
    'products_10m': 0
  };
  
  // Count documents in each collection
  for (const collectionName of ['products_1m', 'products_10m']) {
    try {
      const count = await db.collection(collectionName).countDocuments();
      collections[collectionName] = count;
    } catch (error) {
      // Collection doesn't exist
      collections[collectionName] = 0;
    }
  }
  
  const totalCount = collections['products_1m'] + collections['products_10m'];
  
  return {
    documentCount: totalCount,
    collections,
    allCollections: await db.listCollections().toArray()
  };
}

module.exports = {
  connectToDatabase,
  generateSampleData,
  getStatistics
};

