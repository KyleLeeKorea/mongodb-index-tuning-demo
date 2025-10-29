# MongoDB Index Tuning Demo - Setup Instructions

## Quick Start

### Option 1: Using the startup script
```bash
./start.sh
```

### Option 2: Manual setup
```bash
# Install dependencies
npm install

# Start the server
npm start
```

## MongoDB Connection

The application is configured to connect to:
```
mongodb+srv://id:password@your_mongodb_url.mongodb.net/
```

To change the connection string, edit `config.js`:
```javascript
module.exports = {
  MONGODB_URI: 'your-connection-string-here',
  DB_NAME: 'index_tuning_demo',
  SAMPLE_DATA_COUNT: 1000000,
  PORT: 3000
};
```

## MongoDB Connection

1. **Enter your connection URI** in the web interface at http://localhost:3000
2. **Click "Connect"** to establish the connection
3. The connection will be used for all subsequent operations

## Usage

1. **Connect** to your MongoDB Atlas instance
2. **Generate sample data**: Choose 1M (~2 min) or 10M (~20 min)
3. **Check statistics** to verify document count
4. **Run scenarios** individually or use "Run All Scenarios"

## Scenarios Explained

### Scenario 1: Index Presence Comparison
- **Without Index**: Full collection scan
- **With Index**: Index scan
- **Metrics**: Execution time, documents examined

### Scenario 2: Index Order (abc vs cba)
- Shows how field order affects performance
- Demonstrates optimal index matching to query

### Scenario 3: Index Prefix Comparison
- **Index abc**: {category: 1, price: 1, brand: 1}
- **Index ab**: {category: 1, price: 1}
- Shows that indexes can be used for query prefixes

### Scenario 4: ESR Pattern
- **ESR (Recommended)**: Equality → Sort → Range
- **ERS (Incorrect)**: Equality → Range → Sort
- Demonstrates MongoDB's recommended index ordering

## Troubleshooting

### Connection Issues
If you get connection errors:
1. Verify your MongoDB Atlas connection string
2. Check that your IP is whitelisted in Atlas
3. Ensure database user has read/write permissions

### Performance Issues
- First query after index creation may be slower (index warmup)
- Network latency affects execution time measurements
- Use actual production data for accurate measurements

### Data Generation
- **1M documents**: ~2 minutes to generate - good for quick tests
- **10M documents**: ~20 minutes to generate - better for demonstrating impact
- Progress is shown in console and web interface
- Existing data is cleared before new generation

## Files Structure

```
IndexApp/
├── config.js           # Configuration file
├── database.js         # MongoDB connection and data generation
├── server.js           # Express server and API routes
├── index.html          # Web interface
├── package.json        # Dependencies
├── start.sh           # Startup script
└── README.md          # Documentation
```

## API Endpoints

- `POST /api/generate-data` - Generate sample data
- `GET /api/statistics` - Get database statistics
- `POST /api/scenario1` - Run scenario 1
- `POST /api/scenario2` - Run scenario 2
- `POST /api/scenario3` - Run scenario 3
- `POST /api/scenario4` - Run scenario 4

## Next Steps

1. Experiment with different queries in each scenario
2. Modify index definitions to test various combinations
3. Compare results with MongoDB Atlas Performance Advisor
4. Use production data for real-world testing

