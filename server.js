const express = require('express');
const path = require('path');
const { connectToDatabase, generateSampleData, getStatistics } = require('./database');
const config = require('./config');

const app = express();
const PORT = process.env.PORT || config.PORT;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Update MongoDB connection endpoint
app.post('/api/update-connection', async (req, res) => {
  try {
    const { connectionUri } = req.body;
    if (!connectionUri) {
      return res.status(400).json({ success: false, error: 'Connection URI is required' });
    }

    // Store the connection URI in memory for this session
    // In production, you might want to use session or Redis
    global.mongodbUri = connectionUri;
    
    res.json({ 
      success: true, 
      message: 'Connection URI updated successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate sample data endpoint
app.post('/api/generate-data', async (req, res) => {
  try {
    const { count = 1000000 } = req.body;
    
    // Use the session-specific connection URI if available
    if (global.mongodbUri) {
      process.env.MONGODB_URI = global.mongodbUri;
    }
    
    const result = await generateSampleData(count);
    res.json({ 
      success: true, 
      message: `Generated ${result.insertedCount} documents`,
      collections: result.collections
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get collection statistics
app.get('/api/statistics', async (req, res) => {
  try {
    // Use the session-specific connection URI if available
    if (global.mongodbUri) {
      process.env.MONGODB_URI = global.mongodbUri;
    }
    const stats = await getStatistics();
    res.json({ success: true, statistics: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Run query without indexes
app.post('/api/query/no-index', async (req, res) => {
  try {
    const { collection, filter, limit } = req.body;
    const { client, db } = await connectToDatabase();
    const col = db.collection(collection);
    
    const startTime = Date.now();
    // Drop all indexes except _id
    await col.dropIndexes().catch(() => {});
    const cursor = await col.find(filter).limit(limit || 100);
    const results = await cursor.toArray();
    const executionTime = Date.now() - startTime;
    
    const explain = await col.find(filter).limit(limit || 100).explain("executionStats");
    
    await client.close();
    res.json({
      success: true,
      executionTime,
      resultCount: results.length,
      explain: explain.executionStats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Run query with index
app.post('/api/query/with-index', async (req, res) => {
  try {
    const { collection, filter, index, limit } = req.body;
    const { client, db } = await connectToDatabase();
    const col = db.collection(collection);
    
    // Create the index
    await col.createIndex(index);
    
    const startTime = Date.now();
    const cursor = await col.find(filter).limit(limit || 100);
    const results = await cursor.toArray();
    const executionTime = Date.now() - startTime;
    
    const explain = await col.find(filter).limit(limit || 100).explain("executionStats");
    
    await client.close();
    res.json({
      success: true,
      executionTime,
      resultCount: results.length,
      explain: explain.executionStats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Scenario 1: No index vs with index
app.post('/api/scenario1', async (req, res) => {
  try {
    // Use the session-specific connection URI if available
    if (global.mongodbUri) {
      process.env.MONGODB_URI = global.mongodbUri;
    }
    const { filter, index, limit, dataSize } = req.body;
    const { db } = await connectToDatabase();
    const collectionName = dataSize === '1m' ? 'products_1m' : 'products_10m';
    const col = db.collection(collectionName);
    
    // Test without index
    await col.dropIndexes().catch(() => {});
    
    // Warm up query
    await col.find(filter).limit(1).toArray();
    
    // Run query without index 5 times and take average
    let totalTime = 0;
    let explain1 = null;
    
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await col.find(filter).limit(limit || 100).toArray();
      totalTime += Date.now() - start;
      if (i === 4) {
        explain1 = await col.find(filter).limit(limit || 100).explain("executionStats");
      }
    }
    const time1 = Math.round(totalTime / 5);
    
    // Test with index - create index first and let it settle
    await col.createIndex(index);
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for index to be ready
    
    // Warm up with a few queries to ensure the index is ready
    for (let i = 0; i < 2; i++) {
      await col.find(filter).limit(1).toArray();
    }
    
    // Run query with index 5 times and take average (more runs for stability)
    totalTime = 0;
    let explain2 = null;
    
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await col.find(filter).limit(limit || 100).toArray();
      totalTime += Date.now() - start;
      if (i === 4) {
        explain2 = await col.find(filter).limit(limit || 100).explain("executionStats");
      }
    }
    const time2 = Math.round(totalTime / 5);
    
    res.json({
      success: true,
      mql: {
        query: JSON.stringify(filter, null, 2),
        sort: null,
        index: JSON.stringify(index, null, 2)
      },
      noIndex: {
        executionTime: time1,
        resultCount: 100,
        executionStats: explain1.executionStats
      },
      withIndex: {
        executionTime: time2,
        resultCount: 100,
        executionStats: explain2.executionStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Scenario 2: Index order comparison
app.post('/api/scenario2', async (req, res) => {
  try {
    // Use the session-specific connection URI if available
    if (global.mongodbUri) {
      process.env.MONGODB_URI = global.mongodbUri;
    }
    const { filter, index1, index2, limit, dataSize } = req.body;
    const { db } = await connectToDatabase();
    const collectionName = dataSize === '1m' ? 'products_1m' : 'products_10m';
    const col = db.collection(collectionName);
    
    // Drop all indexes except _id
    await col.dropIndexes().catch(() => {});
    
    // Create and test index1
    await col.createIndex(index1);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    let totalTime = 0;
    let explain1 = null;
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      await col.find(filter).limit(limit || 100).toArray();
      totalTime += Date.now() - start;
      if (i === 2) explain1 = await col.find(filter).limit(limit || 100).explain("executionStats");
    }
    const time1 = Math.round(totalTime / 3);
    
    // Drop all and create index2
    await col.dropIndexes().catch(() => {});
    await col.createIndex(index2);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    totalTime = 0;
    let explain2 = null;
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      await col.find(filter).limit(limit || 100).toArray();
      totalTime += Date.now() - start;
      if (i === 2) explain2 = await col.find(filter).limit(limit || 100).explain("executionStats");
    }
    const time2 = Math.round(totalTime / 3);
    
    res.json({
      success: true,
      mql: {
        query: JSON.stringify(filter, null, 2),
        sort: null,
        index1: JSON.stringify(index1, null, 2),
        index2: JSON.stringify(index2, null, 2)
      },
      index1: {
        executionTime: time1,
        resultCount: 100,
        executionStats: explain1.executionStats
      },
      index2: {
        executionTime: time2,
        resultCount: 100,
        executionStats: explain2.executionStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Scenario 3: Compound index prefixes
app.post('/api/scenario3', async (req, res) => {
  try {
    // Use the session-specific connection URI if available
    if (global.mongodbUri) {
      process.env.MONGODB_URI = global.mongodbUri;
    }
    const { filter, index1, index2, limit, dataSize } = req.body;
    const { db } = await connectToDatabase();
    const collectionName = dataSize === '1m' ? 'products_1m' : 'products_10m';
    const col = db.collection(collectionName);
    
    // Drop all indexes except _id
    await col.dropIndexes().catch(() => {});
    
    // Create and test index1
    await col.createIndex(index1);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    let totalTime = 0;
    let explain1 = null;
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      await col.find(filter).limit(limit || 100).toArray();
      totalTime += Date.now() - start;
      if (i === 2) explain1 = await col.find(filter).limit(limit || 100).explain("executionStats");
    }
    const time1 = Math.round(totalTime / 3);
    
    // Drop all and create index2
    await col.dropIndexes().catch(() => {});
    await col.createIndex(index2);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    totalTime = 0;
    let explain2 = null;
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      await col.find(filter).limit(limit || 100).toArray();
      totalTime += Date.now() - start;
      if (i === 2) explain2 = await col.find(filter).limit(limit || 100).explain("executionStats");
    }
    const time2 = Math.round(totalTime / 3);
    
    res.json({
      success: true,
      mql: {
        query: JSON.stringify(filter, null, 2),
        sort: null,
        index1: JSON.stringify(index1, null, 2),
        index2: JSON.stringify(index2, null, 2)
      },
      index1: {
        executionTime: time1,
        resultCount: 100,
        executionStats: explain1.executionStats
      },
      index2: {
        executionTime: time2,
        resultCount: 100,
        executionStats: explain2.executionStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Scenario 4: ESR vs ERS
app.post('/api/scenario4', async (req, res) => {
  try {
    // Use the session-specific connection URI if available
    if (global.mongodbUri) {
      process.env.MONGODB_URI = global.mongodbUri;
    }
    const { filter, sort, index1, index2, limit, dataSize } = req.body;
    const { db } = await connectToDatabase();
    const collectionName = dataSize === '1m' ? 'products_1m' : 'products_10m';
    const col = db.collection(collectionName);
    
    // Drop all indexes except _id
    await col.dropIndexes().catch(() => {});
    
    // Create and test index1 (ESR)
    await col.createIndex(index1);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    let totalTime = 0;
    let explain1 = null;
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      await col.find(filter).sort(sort).limit(limit || 100).toArray();
      totalTime += Date.now() - start;
      if (i === 2) explain1 = await col.find(filter).sort(sort).limit(limit || 100).explain("executionStats");
    }
    const time1 = Math.round(totalTime / 3);
    
    // Drop all and create index2 (ERS)
    await col.dropIndexes().catch(() => {});
    await col.createIndex(index2);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    totalTime = 0;
    let explain2 = null;
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      await col.find(filter).sort(sort).limit(limit || 100).toArray();
      totalTime += Date.now() - start;
      if (i === 2) explain2 = await col.find(filter).sort(sort).limit(limit || 100).explain("executionStats");
    }
    const time2 = Math.round(totalTime / 3);
    
    res.json({
      success: true,
      mql: {
        query: JSON.stringify(filter, null, 2),
        sort: JSON.stringify(sort, null, 2),
        index1: JSON.stringify(index1, null, 2),
        index2: JSON.stringify(index2, null, 2)
      },
      index1: {
        executionTime: time1,
        resultCount: 100,
        executionStats: explain1.executionStats
      },
      index2: {
        executionTime: time2,
        resultCount: 100,
        executionStats: explain2.executionStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Scenario 5: Index Direction Comparison
app.post('/api/scenario5', async (req, res) => {
  try {
    // Use the session-specific connection URI if available
    if (global.mongodbUri) {
      process.env.MONGODB_URI = global.mongodbUri;
    }
    const { filter, sort, index1, index2, limit, dataSize } = req.body;
    const { db } = await connectToDatabase();
    const collectionName = dataSize === '1m' ? 'products_1m' : 'products_10m';
    const col = db.collection(collectionName);
    
    // Test without index
    await col.dropIndexes().catch(() => {});
    
    let totalTime = 0;
    let explain1 = null;
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      await col.find(filter).sort(sort).limit(limit || 100).toArray();
      totalTime += Date.now() - start;
      if (i === 2) explain1 = await col.find(filter).sort(sort).limit(limit || 100).explain("executionStats");
    }
    const time1 = Math.round(totalTime / 3);
    
    // Create index1 (순서 맞는 인덱스) and test
    await col.createIndex(index1);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    totalTime = 0;
    let explain2 = null;
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      await col.find(filter).sort(sort).limit(limit || 100).toArray();
      totalTime += Date.now() - start;
      if (i === 2) explain2 = await col.find(filter).sort(sort).limit(limit || 100).explain("executionStats");
    }
    const time2 = Math.round(totalTime / 3);
    
    // Drop all and create index2 (역방향 인덱스) and test
    await col.dropIndexes().catch(() => {});
    await col.createIndex(index2);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    totalTime = 0;
    let explain3 = null;
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      await col.find(filter).sort(sort).limit(limit || 100).toArray();
      totalTime += Date.now() - start;
      if (i === 2) explain3 = await col.find(filter).sort(sort).limit(limit || 100).explain("executionStats");
    }
    const time3 = Math.round(totalTime / 3);
    
    res.json({
      success: true,
      mql: {
        query: JSON.stringify(filter, null, 2),
        sort: JSON.stringify(sort, null, 2),
        index1: JSON.stringify(index1, null, 2),
        index2: JSON.stringify(index2, null, 2)
      },
      noIndex: {
        executionTime: time1,
        resultCount: 100,
        executionStats: explain1.executionStats
      },
      index1: {
        executionTime: time2,
        resultCount: 100,
        executionStats: explain2.executionStats
      },
      index2: {
        executionTime: time3,
        resultCount: 100,
        executionStats: explain3.executionStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

